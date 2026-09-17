import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ freeze: vi.fn(), render: vi.fn(), create: vi.fn(), revoke: vi.fn() }));
vi.mock("./glass-snapshot", () => ({ freezeWallpaper: mocks.freeze, renderGlassSnapshot: mocks.render }));
vi.mock("@tauri-apps/api/core", () => ({ convertFileSrc: (path: string) => `asset:${path}` }));
import { useGlassWallpaper } from "./use-glass-wallpaper";
import { DEFAULT_WORKSPACE_WALLPAPER, type WorkspaceWallpaperSettings } from "./workspaceWallpaper";

const settings: WorkspaceWallpaperSettings = { ...DEFAULT_WORKSPACE_WALLPAPER, mode: "custom", mediaPath: "wall.mp4" };
function Harness({ value }: { value: WorkspaceWallpaperSettings }) { useGlassWallpaper(value); return null; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
let root: Root, host: HTMLDivElement;
const frame = { canvas: {} as HTMLCanvasElement, naturalWidth: 1200, naturalHeight: 800 };
const draw = async (value = settings) => { await act(async () => { root.render(<Harness value={value} />); }); };
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers();
  mocks.freeze.mockResolvedValue(frame); mocks.render.mockResolvedValue(new Blob(["snapshot"]));
  let id = 0; mocks.create.mockImplementation(() => `blob:glass-${++id}`);
  vi.stubGlobal("URL", { createObjectURL: mocks.create, revokeObjectURL: mocks.revoke });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  document.documentElement.classList.remove("dark");
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});
it("builds once, shares one URL and never rebuilds on playback or unrelated renders", async () => {
  await draw();
  expect(mocks.freeze).toHaveBeenCalledOnce(); expect(mocks.render).toHaveBeenCalledOnce();
  await draw({ ...settings, paused: true });
  await act(async () => vi.advanceTimersByTime(60000));
  expect(mocks.freeze).toHaveBeenCalledOnce(); expect(mocks.render).toHaveBeenCalledOnce();
  expect(document.documentElement.dataset.glassCache).toBe("ready");
  expect(document.documentElement.style.getPropertyValue("--glass-wallpaper-image")).toBe('url("blob:glass-1")');
});
it("reuses the frozen video frame on config changes and revokes replaced URLs", async () => {
  await draw(); await draw({ ...settings, darken: 30 });
  expect(mocks.freeze).toHaveBeenCalledOnce(); expect(mocks.render).toHaveBeenCalledTimes(2);
  expect(mocks.revoke).toHaveBeenCalledWith("blob:glass-1");
});
it("debounces resize bursts without capturing a new video frame", async () => {
  await draw();
  vi.stubGlobal("innerWidth", 1920);
  await act(async () => { window.dispatchEvent(new Event("resize")); vi.advanceTimersByTime(200); window.dispatchEvent(new Event("resize")); vi.advanceTimersByTime(249); });
  expect(mocks.render).toHaveBeenCalledOnce();
  await act(async () => vi.advanceTimersByTime(1));
  expect(mocks.render).toHaveBeenCalledTimes(2); expect(mocks.freeze).toHaveBeenCalledOnce();
});
it("rebuilds matte colors on theme change without decoding again", async () => {
  await draw();
  await act(async () => { document.documentElement.classList.add("dark"); });
  expect(mocks.render).toHaveBeenCalledTimes(2);
  expect(mocks.render.mock.calls[1][3]).toBe(true); expect(mocks.freeze).toHaveBeenCalledOnce();
});
it("rejects late frames when switching wallpaper during decode", async () => {
  const late = deferred<typeof frame>(); mocks.freeze.mockReturnValueOnce(late.promise);
  await draw(); const oldSignal = mocks.freeze.mock.calls[0][2] as AbortSignal;
  await draw({ ...settings, mediaPath: "new.jpg" });
  await act(async () => late.resolve(frame));
  expect(oldSignal.aborted).toBe(true); expect(mocks.render).toHaveBeenCalledOnce();
});
it("does not publish a stale render result", async () => {
  const late = deferred<Blob>(); mocks.render.mockReturnValueOnce(late.promise);
  await draw(); const oldSignal = mocks.render.mock.calls[0][4] as AbortSignal;
  await draw({ ...settings, blur: 20 });
  await act(async () => late.resolve(new Blob(["stale"])));
  expect(oldSignal.aborted).toBe(true); expect(mocks.create).toHaveBeenCalledOnce();
});
it("clears and revokes cache when disabled; stale callbacks cannot restore it", async () => {
  await draw(); await draw(DEFAULT_WORKSPACE_WALLPAPER);
  expect(mocks.revoke).toHaveBeenCalledWith("blob:glass-1");
  expect(document.documentElement.style.getPropertyValue("--glass-wallpaper-image")).toBe("");
  expect(document.documentElement.dataset.glassCache).toBe("none");
});
it("falls back to a static color on decode error without starting a renderer", async () => {
  mocks.freeze.mockRejectedValue(new Error("CORS")); await draw();
  expect(mocks.render).not.toHaveBeenCalled();
  expect(document.documentElement.dataset.glassCache).toBe("error");
  expect(document.documentElement.style.getPropertyValue("--glass-wallpaper-image")).toBe("");
});
it("keeps the last static texture on rebuild failure", async () => {
  await draw(); mocks.render.mockRejectedValue(new Error("worker"));
  await draw({ ...settings, darken: 40 });
  expect(document.documentElement.dataset.glassCache).toBe("error");
  expect(document.documentElement.style.getPropertyValue("--glass-wallpaper-image")).toBe('url("blob:glass-1")');
});
it("cleans up URL, root properties and pending resize on unmount", async () => {
  await draw(); window.dispatchEvent(new Event("resize"));
  await act(async () => root.render(null));
  expect(mocks.revoke).toHaveBeenCalledWith("blob:glass-1");
  expect(document.documentElement.style.getPropertyValue("--glass-wallpaper-image")).toBe("");
  expect(document.documentElement.dataset.glassCache).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});
