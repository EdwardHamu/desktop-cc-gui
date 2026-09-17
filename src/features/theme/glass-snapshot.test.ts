import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { freezeWallpaper, renderGlassSnapshot } from "./glass-snapshot";

let videos: HTMLVideoElement[];
let workers: FakeWorker[];
let draw: ReturnType<typeof vi.fn>;
let readPixels: ReturnType<typeof vi.fn>;
class FakeWorker {
  onmessage?: (event: MessageEvent) => void;
  onerror?: () => void;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() { workers.push(this); }
}
beforeEach(() => {
  vi.useFakeTimers(); videos = []; workers = [];
  const create = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string, options?: ElementCreationOptions) => {
    const element = create(tag, options);
    if (tag === "video") {
      Object.defineProperties(element, { videoWidth: { value: 1920 }, videoHeight: { value: 1080 } });
      videos.push(element as HTMLVideoElement);
    }
    return element;
  }) as typeof document.createElement);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  draw = vi.fn();
  readPixels = vi.fn(() => ({ data: new Uint8ClampedArray(16) }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: draw, getImageData: readPixels, fillRect: vi.fn(),
    createImageData: () => ({ data: new Uint8ClampedArray(16) }), putImageData: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["jpeg"], { type: "image/jpeg" })));
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("freezes a video once without playback, and releases its decode element", async () => {
  const task = freezeWallpaper("asset:video", true, new AbortController().signal);
  const video = videos[0];
  video.dispatchEvent(new Event("loadeddata"));
  const frame = await task;
  expect(frame.canvas.width).toBe(1600); expect(frame.canvas.height).toBe(900);
  expect(draw).toHaveBeenCalledOnce(); expect(video.play).not.toHaveBeenCalled();
  expect(video.getAttribute("src")).toBeNull();
  video.dispatchEvent(new Event("loadeddata"));
  expect(draw).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});
it("aborts media decoding and removes pending listeners/timers", async () => {
  const abort = new AbortController();
  const task = freezeWallpaper("asset:video", true, abort.signal);
  const rejected = expect(task).rejects.toMatchObject({ name: "AbortError" });
  abort.abort(); await rejected;
  videos[0].dispatchEvent(new Event("loadeddata"));
  expect(draw).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it("reports CORS pixel-read failure instead of publishing unblurred content", async () => {
  readPixels.mockImplementation(() => { throw new DOMException("Tainted", "SecurityError"); });
  const task = freezeWallpaper("asset:video", true, new AbortController().signal);
  const rejected = expect(task).rejects.toMatchObject({ name: "SecurityError" });
  videos[0].dispatchEvent(new Event("loadeddata")); await rejected;
  expect(videos[0].getAttribute("src")).toBeNull(); expect(vi.getTimerCount()).toBe(0);
});
it("bounds an unresponsive media load with a timeout", async () => {
  const task = freezeWallpaper("asset:video", true, new AbortController().signal);
  const rejected = expect(task).rejects.toThrow("decoded");
  await vi.advanceTimersByTimeAsync(20000); await rejected;
  expect(videos[0].getAttribute("src")).toBeNull(); expect(vi.getTimerCount()).toBe(0);
});
const render = (signal = new AbortController().signal) => renderGlassSnapshot(
  { canvas: document.createElement("canvas"), naturalWidth: 2, naturalHeight: 2 },
  { blur: 0, darken: 0, objectFit: "cover" }, { width: 2, height: 2 }, false, signal,
);
it("transfers pixels to a worker, encodes its result, then terminates it", async () => {
  const task = render();
  expect(workers[0].postMessage).toHaveBeenCalledOnce();
  const message = workers[0].postMessage.mock.calls[0][0];
  expect(message.radius).toBe(10);
  workers[0].onmessage?.({ data: { pixels: new ArrayBuffer(16) } } as MessageEvent);
  expect((await task).type).toBe("image/jpeg");
  expect(workers[0].terminate).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});
it("terminates an in-flight blur on abort and does not encode a result", async () => {
  const abort = new AbortController(); const task = render(abort.signal);
  const rejected = expect(task).rejects.toMatchObject({ name: "AbortError" });
  abort.abort(); await rejected;
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it("terminates a failed worker and reports the failure", async () => {
  const task = render(); const rejected = expect(task).rejects.toThrow("worker failed");
  workers[0].onerror?.(); await rejected;
  expect(workers[0].terminate).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});
