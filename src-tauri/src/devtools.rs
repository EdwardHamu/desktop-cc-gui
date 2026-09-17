/// Open only the invoking desktop WebView, never an arbitrary remote window.
/// Async commands avoid blocking the Windows IPC handler on WebView operations.
#[tauri::command]
pub async fn open_devtools(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(desktop)]
    {
        window.open_devtools();
        Ok(())
    }
    #[cfg(mobile)]
    {
        let _ = window;
        Err("Developer tools are only available on desktop".into())
    }
}
