import { invoke, isTauri } from "@tauri-apps/api/core";
import { isMacPlatform, matchesShortcutForPlatform } from "./shortcuts";

/** Desktop-only reserved shortcuts; do not route this command over the web bridge. */
export function handleDevtoolsShortcut(event: KeyboardEvent): boolean {
  if (!isTauri() || event.defaultPrevented || event.isComposing) return false;
  const shortcut = isMacPlatform() ? "cmd+alt+i" : "ctrl+shift+i";
  if (
    !matchesShortcutForPlatform(event, "f12") &&
    !matchesShortcutForPlatform(event, shortcut)
  ) return false;

  event.preventDefault();
  // Consume repeats too, preventing the WebView's native shortcut from firing.
  if (!event.repeat) {
    void invoke("open_devtools").catch((error: unknown) => {
      console.error("[devtools] Failed to open developer tools", error);
    });
  }
  return true;
}
