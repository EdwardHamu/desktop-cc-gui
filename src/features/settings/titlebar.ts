import { useEffect, useState } from "react";
import { ipc } from "@/lib/ipc";
import { IS_WINDOWS, isWeb } from "@/lib/platform";

export type TitlebarStyle = "internal" | "native" | "mac";

export function resolveTitlebarStyle(value: unknown): TitlebarStyle {
  if (value === "native") return "native";
  if (value === "mac" && IS_WINDOWS) return "mac";
  return "internal";
}

// Freeze the startup mode across component remounts. Saving a different mode
// must not change controls until native window decorations are rebuilt.
let startupStyle: Promise<TitlebarStyle> | undefined;
function readStartupStyle() {
  return startupStyle ??= Promise.resolve().then(() => ipc.getAppSettings())
    .then(settings => resolveTitlebarStyle(settings.titlebar))
    .catch(() => "internal" as const);
}

export function useTitlebarStyle(): TitlebarStyle {
  const [style, setStyle] = useState<TitlebarStyle>("internal");
  useEffect(() => {
    if (isWeb) return;
    let alive = true;
    void readStartupStyle().then(value => { if (alive) setStyle(value); });
    return () => { alive = false; };
  }, []);
  return style;
}

/** Only the upstream Windows mac-style mode needs traffic-light controls. */
export function needsWindowControls(style: TitlebarStyle): boolean {
  return IS_WINDOWS && !isWeb && style === "mac";
}
