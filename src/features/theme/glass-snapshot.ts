import { boundedBitmapSize, wallpaperRect } from "./glass-bitmap";
import type { WorkspaceWallpaperSettings } from "./workspaceWallpaper";

export interface FrozenWallpaper {
  canvas: HTMLCanvasElement;
  naturalWidth: number;
  naturalHeight: number;
}
export const abortError = () => new DOMException("Snapshot cancelled", "AbortError");

/** Independently decode exactly one frame. Never seek/play the visible video. */
export function freezeWallpaper(src: string, video: boolean, signal: AbortSignal): Promise<FrozenWallpaper> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const media = video ? document.createElement("video") : new Image();
    const readyEvent = video ? "loadeddata" : "load";
    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      media.removeEventListener(readyEvent, ready);
      media.removeEventListener("error", failed);
      if (media instanceof HTMLVideoElement) { media.pause(); media.removeAttribute("src"); media.load(); }
      else media.removeAttribute("src");
    };
    const failed = () => { cleanup(); reject(new Error("Wallpaper snapshot could not be decoded (or CORS denied)")); };
    const abort = () => { cleanup(); reject(abortError()); };
    const ready = () => {
      try {
        const naturalWidth = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
        const naturalHeight = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
        if (!naturalWidth || !naturalHeight) throw new Error("Empty wallpaper frame");
        const size = boundedBitmapSize(naturalWidth, naturalHeight);
        const canvas = document.createElement("canvas");
        canvas.width = size.width; canvas.height = size.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        context.drawImage(media, 0, 0, size.width, size.height);
        // Fail here on a tainted source rather than silently skipping the blur.
        context.getImageData(0, 0, 1, 1);
        cleanup();
        resolve({ canvas, naturalWidth, naturalHeight });
      } catch (error) { cleanup(); reject(error); }
    };
    const timeout = setTimeout(failed, 20000);
    signal.addEventListener("abort", abort, { once: true });
    media.addEventListener(readyEvent, ready, { once: true });
    media.addEventListener("error", failed, { once: true });
    media.crossOrigin = "anonymous";
    if (media instanceof HTMLVideoElement) { media.muted = true; media.preload = "auto"; media.playsInline = true; }
    try {
      media.src = src;
      if (media instanceof HTMLVideoElement) media.load();
    } catch (error) { cleanup(); reject(error); }
  });
}

/** Composite the frozen frame once; all blur work is off the UI thread. */
export async function renderGlassSnapshot(
  frame: FrozenWallpaper,
  settings: Pick<WorkspaceWallpaperSettings, "objectFit" | "blur" | "darken">,
  viewport: { width: number; height: number },
  dark: boolean,
  signal: AbortSignal,
): Promise<Blob> {
  if (signal.aborted) throw abortError();
  const size = boundedBitmapSize(viewport.width, viewport.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width; canvas.height = size.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas unavailable");
  // Opaque matte makes contain/center gaps static too, not windows onto video.
  context.fillStyle = dark ? "#171717" : "#f5f5f5";
  context.fillRect(0, 0, size.width, size.height);
  const rect = wallpaperRect(frame.naturalWidth, frame.naturalHeight, viewport.width, viewport.height, settings.objectFit, settings.blur);
  context.drawImage(frame.canvas, rect.x * size.scale, rect.y * size.scale, rect.width * size.scale, rect.height * size.scale);
  if (settings.darken > 0) {
    context.fillStyle = `rgb(0 0 0 / ${settings.darken / 100})`;
    context.fillRect(0, 0, size.width, size.height);
  }
  const data = context.getImageData(0, 0, size.width, size.height);
  const pixels = await new Promise<ArrayBuffer>((resolve, reject) => {
    const worker = new Worker(new URL("./glass-blur.worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => { clearTimeout(timeout); signal.removeEventListener("abort", abort); worker.terminate(); };
    const abort = () => { cleanup(); reject(abortError()); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error("Wallpaper blur timed out")); }, 20000);
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => { cleanup(); reject(new Error("Wallpaper blur worker failed")); };
    worker.onmessage = (event: MessageEvent<{ pixels?: ArrayBuffer; error?: string }>) => {
      cleanup();
      if (event.data.pixels) resolve(event.data.pixels);
      else reject(new Error(event.data.error ?? "Empty wallpaper blur result"));
    };
    try {
      worker.postMessage({ pixels: data.data.buffer, width: size.width, height: size.height, radius: Math.sqrt(settings.blur ** 2 + 10 ** 2) * size.scale }, [data.data.buffer]);
    } catch (error) { cleanup(); reject(error); }
  });
  if (signal.aborted) throw abortError();
  const output = context.createImageData(size.width, size.height);
  output.data.set(new Uint8ClampedArray(pixels));
  context.putImageData(output, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (signal.aborted) reject(abortError());
    else if (blob) resolve(blob);
    else reject(new Error("Wallpaper snapshot encoding failed"));
  }, "image/jpeg", .92));
}
