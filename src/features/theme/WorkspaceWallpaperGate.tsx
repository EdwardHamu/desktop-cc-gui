/**
 * Loads the persisted wallpaper once and feeds WorkspaceWallpaperHost.
 *
 * Split from the host so the host stays a pure function of its props (easy to
 * test and to drive from a live preview in Settings). Settings broadcasts
 * changes on the shared event below so the wallpaper updates without a reload.
 */
import { useEffect, useState } from "react";
import { ipc, type AppSettings } from "@/lib/ipc";
import { useGlassWallpaper } from "./use-glass-wallpaper";
import { WorkspaceWallpaperHost } from "./WorkspaceWallpaperHost";
import {
  DEFAULT_WORKSPACE_WALLPAPER,
  resolveWorkspaceWallpaper,
  type WorkspaceWallpaperSettings,
} from "./workspaceWallpaper";

/** Fired by Settings after a wallpaper change is saved. */
export const WALLPAPER_CHANGE_EVENT = "ccgui:workspace-wallpaper-changed";

export function publishWallpaperChange(next: WorkspaceWallpaperSettings): void {
  window.dispatchEvent(new CustomEvent(WALLPAPER_CHANGE_EVENT, { detail: next }));
}

export function WorkspaceWallpaperGate() {
  const [wallpaper, setWallpaper] = useState<WorkspaceWallpaperSettings>(
    DEFAULT_WORKSPACE_WALLPAPER,
  );

  useEffect(() => {
    let active = true;
    void ipc
      .getAppSettings()
      .then((settings: AppSettings) => {
        if (active) setWallpaper(resolveWorkspaceWallpaper(settings.workspaceWallpaper));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceWallpaperSettings>).detail;
      setWallpaper(resolveWorkspaceWallpaper(detail));
    };
    window.addEventListener(WALLPAPER_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(WALLPAPER_CHANGE_EVENT, onChange);
  }, []);

  useGlassWallpaper(wallpaper);

  // The app shell paints an opaque canvas; flag the root so the stylesheet can
  // make those surfaces translucent only while a wallpaper is actually shown.
  const active = wallpaper.mode === "custom" && wallpaper.mediaPath !== null;
  useEffect(() => {
    const root = document.documentElement;
    if (active) {
      root.setAttribute("data-wallpaper", "on");
    } else {
      root.removeAttribute("data-wallpaper");
    }
    return () => root.removeAttribute("data-wallpaper");
  }, [active]);

  return <WorkspaceWallpaperHost wallpaper={wallpaper} />;
}
