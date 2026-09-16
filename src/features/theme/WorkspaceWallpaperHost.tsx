/**
 * Renders the workspace wallpaper behind the app shell.
 *
 * Mounted once at the app root. Sits in a fixed, pointer-events-none layer at
 * z-index 0 with the shell above it; when mode is "none" it renders nothing at
 * all, so the default opaque canvas is completely unaffected.
 *
 * Local files are loaded through Tauri's asset protocol (already enabled with
 * a $HOME/** scope in tauri.conf.json), not fetch(), so no file bytes cross
 * the IPC boundary.
 */
import { useEffect, useRef } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  cssObjectFit,
  isVideoWallpaper,
  type WorkspaceWallpaperSettings,
} from "./workspaceWallpaper";

export function WorkspaceWallpaperHost({
  wallpaper,
}: {
  wallpaper: WorkspaceWallpaperSettings;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { mode, mediaPath, blur, darken, objectFit, paused } = wallpaper;
  const isVideo = isVideoWallpaper(mediaPath);

  // Keep playback in sync with the setting without remounting the element,
  // which would restart the video and flash the canvas.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (paused) {
      el.pause();
    } else {
      void el.play().catch(() => undefined);
    }
  }, [paused, mediaPath]);

  if (mode !== "custom" || !mediaPath) {
    return null;
  }

  const src = convertFileSrc(mediaPath);
  const fit = cssObjectFit(objectFit);
  const mediaStyle = {
    width: "100%",
    height: "100%",
    objectFit: fit as React.CSSProperties["objectFit"],
    filter: blur > 0 ? `blur(${blur}px)` : undefined,
    // Blur samples transparent pixels past the edge and leaves a soft border;
    // scaling up slightly pushes that fringe outside the viewport.
    transform: blur > 0 ? `scale(${1 + blur / 100})` : undefined,
  } satisfies React.CSSProperties;

  return (
    <div className="workspace-wallpaper-host" aria-hidden="true" data-media-kind={isVideo ? "video" : "image"}>
      {isVideo ? (
        <video
          ref={videoRef}
          src={src}
          style={mediaStyle}
          autoPlay={!paused}
          loop
          muted
          playsInline
          // A wallpaper that fails to decode should vanish, not show a broken
          // media chrome over the canvas.
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <img
          src={src}
          alt=""
          style={mediaStyle}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      {darken > 0 ? (
        <div className="workspace-wallpaper-scrim" style={{ opacity: darken / 100 }} />
      ) : null}
    </div>
  );
}
