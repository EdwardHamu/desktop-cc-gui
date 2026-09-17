import { blurGlassPixels } from "./glass-bitmap";

self.onmessage = (event: MessageEvent<{ pixels: ArrayBuffer; width: number; height: number; radius: number }>) => {
  try {
    const { pixels, width, height, radius } = event.data;
    const result = blurGlassPixels(new Uint8ClampedArray(pixels), width, height, radius);
    self.postMessage({ pixels: result.buffer }, { transfer: [result.buffer] });
  } catch {
    self.postMessage({ error: "Unable to blur wallpaper snapshot" });
  }
};
