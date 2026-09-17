//! Native, process-wide completion alerts. No WebView focus or timer dependency.
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::Value;
use tauri::Runtime;

const RECENT_LIMIT: usize = 1024;

#[derive(Default)]
struct CompletedRuns(VecDeque<String>);

impl CompletedRuns {
    fn accept(&mut self, event: &Value) -> bool {
        let kind = event["kind"].as_str().unwrap_or_default();
        if kind != "done" && kind != "error" {
            return false;
        }
        let Some(id) = event["runId"].as_str().filter(|id| !id.is_empty()) else {
            return false;
        };
        if self.0.iter().any(|seen| seen == id) {
            return false;
        }
        self.0.push_back(id.to_owned());
        if self.0.len() > RECENT_LIMIT {
            self.0.pop_front();
        }
        kind == "done" && event["data"]["cancelled"] != true
    }
}

pub fn observer<R: Runtime>(app: tauri::AppHandle<R>) -> Arc<dyn Fn(&Value) + Send + Sync> {
    let recent = Mutex::new(CompletedRuns::default());
    Arc::new(move |event| {
        // Delta/tool/usage events never take a lock or read settings.
        if !matches!(event["kind"].as_str(), Some("done" | "error")) {
            return;
        }
        if !recent
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .accept(event)
        {
            return;
        }
        let app = app.clone();
        // Device initialization, filesystem and desktop-service calls must not
        // block the engine reader or its event batching.
        tauri::async_runtime::spawn_blocking(move || {
            let settings = match crate::settings::read_settings() {
                Ok(settings) => settings,
                Err(error) => {
                    eprintln!("[completion-notification] settings: {error}");
                    return;
                }
            };
            if settings.session_completion_sound {
                tauri::async_runtime::spawn_blocking(|| {
                    if let Err(error) = play_chime() {
                        eprintln!("[completion-notification] sound: {error}");
                    }
                });
            }
            if settings.session_completion_toast {
                if let Err(error) = show_toast(&app, &settings.language) {
                    eprintln!("[completion-notification] toast: {error}");
                }
            }
        });
    })
}

fn show_toast<R: Runtime>(app: &tauri::AppHandle<R>, language: &str) -> Result<(), String> {
    let (title, body) = if language == "en" {
        (
            "CC GUI · Session finished",
            "The current response has finished. You can return to the conversation.",
        )
    } else {
        ("CC GUI · 会话完成", "本轮会话已结束，可以返回查看回复。")
    };
    let mut notification = notify_rust::Notification::new();
    notification.summary(title).body(body);
    // Keep toast audio off: the independent sound toggle owns the chime.
    // notify-rust's Windows backend uses Toast::sound(None) (silent); macOS
    // has no sound unless explicitly set. Linux needs the suppress hint.
    #[cfg(target_os = "linux")]
    notification.hint(notify_rust::Hint::SuppressSound(true));
    #[cfg(windows)]
    {
        let exe = tauri::utils::platform::current_exe().map_err(|e| e.to_string())?;
        let parent = exe
            .parent()
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();
        // Installed builds use the installer-registered app ID. Dev binaries
        // have no registered shortcut; notify-rust uses its dev fallback ID.
        if !parent.ends_with("/target/debug") && !parent.ends_with("/target/release") {
            notification.app_id(&app.config().identifier);
        }
    }
    #[cfg(target_os = "macos")]
    notify_rust::set_application(if tauri::is_dev() {
        "com.apple.Terminal"
    } else {
        &app.config().identifier
    })
    .map_err(|e| e.to_string())?;
    #[cfg(not(any(windows, target_os = "macos")))]
    let _ = app;
    notification.show().map(|_| ()).map_err(|e| e.to_string())
}

fn play_chime() -> Result<(), String> {
    use rodio::Source;
    let stream = rodio::OutputStreamBuilder::open_default_stream().map_err(|e| e.to_string())?;
    let sink = rodio::Sink::connect_new(stream.mixer());
    for frequency in [660.0, 880.0] {
        sink.append(
            rodio::source::SineWave::new(frequency)
                .take_duration(Duration::from_millis(160))
                .fade_in(Duration::from_millis(12))
                .fade_out(Duration::from_millis(45))
                .amplify(0.15),
        );
    }
    sink.sleep_until_end();
    // stream/sink are dropped immediately after this short, synthesized sound.
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn deduplicates_by_run_not_session() {
        let mut recent = CompletedRuns::default();
        let done = json!({"kind":"done", "runId":"a", "sessionId":"same"});
        assert!(recent.accept(&done));
        assert!(!recent.accept(&done));
        assert!(recent.accept(&json!({"kind":"done", "runId":"b", "sessionId":"same"})));
    }

    #[test]
    fn ignores_nonterminal_missing_id_error_and_cancelled() {
        let mut recent = CompletedRuns::default();
        for kind in ["delta", "usage", "tool_end", "retry"] {
            assert!(!recent.accept(&json!({"kind":kind,"runId":"a"})));
        }
        assert!(!recent.accept(&json!({"kind":"done"})));
        assert!(!recent.accept(&json!({"kind":"done","runId":""})));
        assert!(!recent.accept(&json!({"kind":"error","runId":"a"})));
        assert!(!recent.accept(&json!({"kind":"done","runId":"a"})));
        assert!(!recent.accept(&json!({"kind":"done","runId":"b","data":{"cancelled":true}})));
    }

    #[test]
    fn dedup_storage_is_bounded() {
        let mut recent = CompletedRuns::default();
        for id in 0..RECENT_LIMIT + 5 {
            assert!(recent.accept(&json!({"kind":"done","runId":id.to_string()})));
        }
        assert_eq!(recent.0.len(), RECENT_LIMIT);
    }

    #[tokio::test]
    async fn observes_live_event_once_before_flush() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        struct QuietEmitter;
        impl crate::event_sink::Emit for QuietEmitter {
            fn emit_json(&self, _: &str, _: &str) {}
        }
        let count = Arc::new(AtomicUsize::new(0));
        let observed = count.clone();
        let sink = crate::event_sink::EventSink::with_engine_observer(
            Arc::new(QuietEmitter),
            Arc::new(move |_| {
                observed.fetch_add(1, Ordering::SeqCst);
            }),
        );
        sink.push(json!({"kind":"done", "runId":"once"}));
        assert_eq!(count.load(Ordering::SeqCst), 1);
        sink.flush();
        sink.flush();
        assert_eq!(count.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn settings_default_off_and_round_trip_independently() {
        let mut settings: crate::settings::AppSettings = serde_json::from_value(json!({})).unwrap();
        assert!(!settings.session_completion_toast && !settings.session_completion_sound);
        settings.session_completion_toast = true;
        let value = serde_json::to_value(&settings).unwrap();
        assert_eq!(value["sessionCompletionToast"], true);
        assert_eq!(value["sessionCompletionSound"], false);
        let loaded: crate::settings::AppSettings = serde_json::from_value(value).unwrap();
        assert!(loaded.session_completion_toast && !loaded.session_completion_sound);
    }
}
