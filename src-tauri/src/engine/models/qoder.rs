use super::{EngineCatalog, EngineModel};
use std::sync::Mutex;

/// qoder has no static catalog and no cheap list subcommand: the only
/// CLI-sourced list is the ACP session/new handshake (spawns `qodercli
/// --acp`, seconds). Cache the last successful probe so reopening the
/// picker does not re-handshake every time.
static CACHE: Mutex<Option<Vec<EngineModel>>> = Mutex::new(None);

pub(super) async fn qoder_catalog(bin: &str) -> Result<EngineCatalog, String> {
    {
        let cached = CACHE.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(models) = cached.as_ref() {
            return Ok(EngineCatalog::authoritative(models.clone()));
        }
    }
    let entries = crate::engine::qoder_session::probe_models(bin).await?;
    // session/new marks the current model as default: lead with it, since
    // the frontend auto-selects the first entry when nothing is pinned.
    let default_index = entries.iter().position(|entry| entry.is_default);
    let mut models: Vec<EngineModel> = entries
        .into_iter()
        .map(|entry| EngineModel {
            id: entry.id,
            name: entry.name,
            description: None,
            provider: "qoder".to_string(),
            context_window: None,
        })
        .collect();
    if let Some(index) = default_index.filter(|index| *index > 0) {
        let entry = models.remove(index);
        models.insert(0, entry);
    }
    if !models.is_empty() {
        let mut cached = CACHE.lock().unwrap_or_else(|e| e.into_inner());
        *cached = Some(models.clone());
    }
    Ok(EngineCatalog::authoritative(models))
}
