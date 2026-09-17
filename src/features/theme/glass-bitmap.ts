import type { WorkspaceWallpaperObjectFit } from "./workspaceWallpaper";

export const GLASS_CACHE_MAX_EDGE = 1600;
export const GLASS_CACHE_RESIZE_DELAY = 250;

export function boundedBitmapSize(width: number, height: number) {
  const scale = Math.min(1, GLASS_CACHE_MAX_EDGE / Math.max(1, width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
}

/** Centered CSS object-fit geometry, in viewport CSS pixels. */
export function wallpaperRect(sw: number, sh: number, vw: number, vh: number, fit: WorkspaceWallpaperObjectFit, blur: number) {
  let sx = vw / sw;
  let sy = vh / sh;
  if (fit === "cover") sx = sy = Math.max(sx, sy);
  else if (fit === "contain") sx = sy = Math.min(sx, sy);
  else if (fit === "center") sx = sy = 1;
  const zoom = blur > 0 ? 1 + blur / 100 : 1;
  const width = sw * sx * zoom;
  const height = sh * sy * zoom;
  return { x: (vw - width) / 2, y: (vh - height) / 2, width, height };
}

/** Three separable box passes approximate a Gaussian. Runs only in a worker;
 * edge clamping avoids dark/transparent fringes. Input/output are opaque RGBA. */
export function blurGlassPixels(pixels: Uint8ClampedArray, width: number, height: number, radius: number, saturation = 1.25): Uint8ClampedArray {
  let src = new Uint8ClampedArray(pixels);
  let dst = new Uint8ClampedArray(src.length);
  const r = Math.max(1, Math.round(radius));
  const span = r * 2 + 1;
  const pass = (horizontal: boolean) => {
    const length = horizontal ? width : height;
    const lines = horizontal ? height : width;
    const index = (line: number, p: number) => (horizontal ? line * width + p : p * width + line) * 4;
    for (let line = 0; line < lines; line++) {
      const sums = [0, 0, 0];
      for (let k = -r; k <= r; k++) {
        const offset = index(line, Math.max(0, Math.min(length - 1, k)));
        for (let c = 0; c < 3; c++) sums[c] += src[offset + c];
      }
      for (let p = 0; p < length; p++) {
        const offset = index(line, p);
        for (let c = 0; c < 3; c++) dst[offset + c] = sums[c] / span;
        dst[offset + 3] = 255;
        const leaving = index(line, Math.max(0, p - r));
        const entering = index(line, Math.min(length - 1, p + r + 1));
        for (let c = 0; c < 3; c++) sums[c] += src[entering + c] - src[leaving + c];
      }
    }
    [src, dst] = [dst, src];
  };
  for (let i = 0; i < 3; i++) { pass(true); pass(false); }
  for (let p = 0; p < src.length; p += 4) {
    const luminance = .2126 * src[p] + .7152 * src[p + 1] + .0722 * src[p + 2];
    for (let c = 0; c < 3; c++) src[p + c] = luminance + saturation * (src[p + c] - luminance);
  }
  return src;
}
