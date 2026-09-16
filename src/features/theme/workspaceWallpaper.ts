/**
 * Workspace wallpaper — settings model + sanitizers.
 *
 * Ported from the pre-rebase fork, reduced to the static (image/video) half:
 * the old build also carried a 1.2k-line WebGL fluid shader, but the fork
 * disabled fluid on Windows anyway, so it is deliberately left behind rather
 * than resurrected. Modes are "none" | "custom".
 *
 * Persistence rides on AppSettings.workspaceWallpaper (see src/lib/ipc.ts).
 * Every field is optional/defaulted so older config files keep loading.
 */

export const WORKSPACE_WALLPAPER_MODES = ["none", "custom"] as const;
export type WorkspaceWallpaperMode = (typeof WORKSPACE_WALLPAPER_MODES)[number];

export const WORKSPACE_WALLPAPER_OBJECT_FITS = ["cover", "contain", "center", "fill"] as const;
export type WorkspaceWallpaperObjectFit = (typeof WORKSPACE_WALLPAPER_OBJECT_FITS)[number];

/** Percent knobs. Ranges match the fork so persisted values stay meaningful. */
export const MIN_WALLPAPER_BLUR = 0;
export const MAX_WALLPAPER_BLUR = 40;
export const MIN_WALLPAPER_DARKEN = 0;
export const MAX_WALLPAPER_DARKEN = 80;

export const DEFAULT_WALLPAPER_BLUR = 0;
export const DEFAULT_WALLPAPER_DARKEN = 0;
export const DEFAULT_WALLPAPER_OBJECT_FIT: WorkspaceWallpaperObjectFit = "cover";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp"] as const;
const VIDEO_EXTENSIONS = ["mp4", "webm"] as const;

export const WALLPAPER_IMAGE_EXTENSIONS = [...IMAGE_EXTENSIONS];
export const WALLPAPER_VIDEO_EXTENSIONS = [...VIDEO_EXTENSIONS];
export const WALLPAPER_MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

export interface WorkspaceWallpaperSettings {
  mode: WorkspaceWallpaperMode;
  /** Absolute path to the chosen media file; null when unset. */
  mediaPath: string | null;
  /** Backdrop blur in px, applied to the wallpaper layer itself. */
  blur: number;
  /** Darkening scrim over the wallpaper, in percent. */
  darken: number;
  objectFit: WorkspaceWallpaperObjectFit;
  /** Video only: hold on the first frame instead of playing. */
  paused: boolean;
}

export const DEFAULT_WORKSPACE_WALLPAPER: WorkspaceWallpaperSettings = {
  mode: "none",
  mediaPath: null,
  blur: DEFAULT_WALLPAPER_BLUR,
  darken: DEFAULT_WALLPAPER_DARKEN,
  objectFit: DEFAULT_WALLPAPER_OBJECT_FIT,
  paused: false,
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function sanitizeWallpaperBlur(value: unknown): number {
  return clampInt(value, MIN_WALLPAPER_BLUR, MAX_WALLPAPER_BLUR, DEFAULT_WALLPAPER_BLUR);
}

export function sanitizeWallpaperDarken(value: unknown): number {
  return clampInt(value, MIN_WALLPAPER_DARKEN, MAX_WALLPAPER_DARKEN, DEFAULT_WALLPAPER_DARKEN);
}

export function isWallpaperMode(value: unknown): value is WorkspaceWallpaperMode {
  return (
    typeof value === "string" &&
    (WORKSPACE_WALLPAPER_MODES as readonly string[]).includes(value)
  );
}

export function isWallpaperObjectFit(value: unknown): value is WorkspaceWallpaperObjectFit {
  return (
    typeof value === "string" &&
    (WORKSPACE_WALLPAPER_OBJECT_FITS as readonly string[]).includes(value)
  );
}

/** Lowercased extension without the dot; "" when the path has none. */
export function fileExtension(path: string): string {
  const tail = path.split(/[\\/]/).pop() ?? "";
  const dot = tail.lastIndexOf(".");
  return dot <= 0 ? "" : tail.slice(dot + 1).toLowerCase();
}

export function wallpaperFileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? "";
}

export function isVideoWallpaper(path: string | null | undefined): boolean {
  if (!path) return false;
  return (VIDEO_EXTENSIONS as readonly string[]).includes(fileExtension(path));
}

export function isSupportedWallpaperMedia(path: string | null | undefined): boolean {
  if (!path) return false;
  return (WALLPAPER_MEDIA_EXTENSIONS as readonly string[]).includes(fileExtension(path));
}

/** CSS object-fit value; "center" means "don't scale", i.e. object-fit: none. */
export function cssObjectFit(fit: WorkspaceWallpaperObjectFit): string {
  return fit === "center" ? "none" : fit;
}

/**
 * Normalize whatever came back from settings into a complete, in-range object.
 * Unknown or missing media downgrades to mode "none" so a deleted file cannot leave
 * the app rendering an empty wallpaper layer over the canvas.
 */
export function resolveWorkspaceWallpaper(
  raw: Partial<WorkspaceWallpaperSettings> | null | undefined,
): WorkspaceWallpaperSettings {
  const mediaPath =
    typeof raw?.mediaPath === "string" && raw.mediaPath.trim() !== "" ? raw.mediaPath : null;
  const requested = isWallpaperMode(raw?.mode) ? raw.mode : DEFAULT_WORKSPACE_WALLPAPER.mode;
  const usable = mediaPath !== null && isSupportedWallpaperMedia(mediaPath);
  return {
    mode: requested === "custom" && !usable ? "none" : requested,
    mediaPath,
    blur: sanitizeWallpaperBlur(raw?.blur),
    darken: sanitizeWallpaperDarken(raw?.darken),
    objectFit: isWallpaperObjectFit(raw?.objectFit)
      ? raw.objectFit
      : DEFAULT_WALLPAPER_OBJECT_FIT,
    paused: raw?.paused === true,
  };
}
