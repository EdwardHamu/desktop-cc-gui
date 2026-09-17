import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { GLASS_CACHE_RESIZE_DELAY } from "./glass-bitmap";
import { freezeWallpaper, renderGlassSnapshot, type FrozenWallpaper } from "./glass-snapshot";
import { isVideoWallpaper, type WorkspaceWallpaperSettings } from "./workspaceWallpaper";

const IMAGE_PROPERTY = "--glass-wallpaper-image";

/** One cache owner at App's wallpaper gate, not one cache per glass container. */
export function useGlassWallpaper(wallpaper: WorkspaceWallpaperSettings) {
  const key = wallpaper.mode === "custom" ? wallpaper.mediaPath : null;
  const [frozen, setFrozen] = useState<{ key: string; frame: FrozenWallpaper } | null>(null);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const publishedUrl = useRef<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const resize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setViewport((previous) => {
        const width = window.innerWidth, height = window.innerHeight;
        return previous.width === width && previous.height === height ? previous : { width, height };
      }), GLASS_CACHE_RESIZE_DELAY);
    };
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", resize);
    return () => { clearTimeout(timer); observer.disconnect(); window.removeEventListener("resize", resize); };
  }, []);

  // No paused/currentTime/timeupdate dependency: video keeps playing behind the
  // UI, but its glass texture remains the first decoded frame until source change.
  useEffect(() => {
    const controller = new AbortController();
    const root = document.documentElement;
    root.style.removeProperty(IMAGE_PROPERTY);
    if (publishedUrl.current) URL.revokeObjectURL(publishedUrl.current);
    publishedUrl.current = null;
    root.dataset.glassCache = key ? "loading" : "none";
    setFrozen(null);
    if (key) {
      void Promise.resolve().then(() => freezeWallpaper(convertFileSrc(key), isVideoWallpaper(key), controller.signal)).then((frame) => {
        if (!controller.signal.aborted) setFrozen({ key, frame });
      }).catch((error) => {
        if (controller.signal.aborted) return;
        root.dataset.glassCache = "error";
        console.warn("[glass-cache] snapshot unavailable; using static theme color", error);
      });
    }
    return () => controller.abort();
  }, [key]);

  useEffect(() => {
    if (!key || frozen?.key !== key) return;
    const controller = new AbortController();
    void renderGlassSnapshot(frozen.frame, { blur: wallpaper.blur, darken: wallpaper.darken, objectFit: wallpaper.objectFit }, viewport, dark, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const previous = publishedUrl.current;
      document.documentElement.style.setProperty(IMAGE_PROPERTY, `url("${url}")`);
      document.documentElement.dataset.glassCache = "ready";
      publishedUrl.current = url;
      if (previous) URL.revokeObjectURL(previous);
    }).catch((error) => {
      if (controller.signal.aborted) return;
      document.documentElement.dataset.glassCache = "error";
      console.warn("[glass-cache] rebuild failed; retaining last static texture or theme color", error);
    });
    return () => controller.abort();
  }, [key, frozen, wallpaper.blur, wallpaper.darken, wallpaper.objectFit, viewport, dark]);

  useEffect(() => () => {
    document.documentElement.style.removeProperty(IMAGE_PROPERTY);
    delete document.documentElement.dataset.glassCache;
    if (publishedUrl.current) URL.revokeObjectURL(publishedUrl.current);
    publishedUrl.current = null;
  }, []);
}
