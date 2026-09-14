//! Qoder engine — ACP host-session variant.
//!
//! `qodercli --acp` speaks the Agent Client Protocol (JSON-RPC over stdio)
//! and stays resident across requests, so the engine drives its own
//! transport ([`Engine::drives_own_transport`]): each send spawns one child
//! inside [`super::qoder_session::run_acp_turn`], which owns the handshake
//! (initialize → session/new|resume → set_model? → set_mode bypassPermissions
//! → session/prompt) and projects session/update notifications to engine
//! events.

use std::path::Path;

use super::{BuiltCommand, Engine, SendRequest};

pub struct QoderEngine;

impl Engine for QoderEngine {
    fn id(&self) -> &'static str {
        "qoder"
    }

    fn drives_own_transport(&self) -> bool {
        true
    }

    /// Never invoked on the virtual path (`send_host_stream` branches before
    /// the process spawn); a stub keeps the trait contract honest.
    fn build_command(&self, _req: &SendRequest, _bin: &str) -> Result<BuiltCommand, String> {
        Err("qoder runs as an ACP host session; no child command to build".to_string())
    }

    /// Never invoked on the virtual path: ACP frames are JSON-RPC, parsed by
    /// the turn driver, not line-mapped here.
    fn parse_line(&self, _line: &str, _out: &mut Vec<super::EngineEvent>) {}

    fn supports_images(&self) -> bool {
        // session/prompt carries image content blocks (base64).
        true
    }

    fn supported_permissions(&self) -> &'static [&'static str] {
        // A headless ACP turn cannot honor an approval flow: the driver
        // always sets session/set_mode bypassPermissions (permission
        // requests, if any still arrive, are auto-allowed). Only "bypass"
        // is honest.
        &["bypass"]
    }
}

/// File stem of a bin path, lowercased (`/usr/local/bin/qodercli` → `qodercli`).
pub(crate) fn binary_file_stem(bin: &str) -> String {
    Path::new(bin.trim())
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(bin.trim())
        .to_ascii_lowercase()
}

/// The Qoder IDE launcher is also called `qoder` but speaks no ACP; only
/// the CLI (`qodercli`) works as an engine bin.
pub(crate) fn is_qoder_ide_launcher_bin(bin: &str) -> bool {
    binary_file_stem(bin) == "qoder"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ide_launcher_stem_is_rejected() {
        assert!(is_qoder_ide_launcher_bin("/Applications/Qoder.app/qoder"));
        assert!(is_qoder_ide_launcher_bin("qoder"));
        assert!(!is_qoder_ide_launcher_bin("/usr/local/bin/qodercli"));
        assert!(!is_qoder_ide_launcher_bin("qodercli"));
    }
}
