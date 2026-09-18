import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  mode: { isWeb: false },
  native: {
    minimize: vi.fn(), toggleMaximize: vi.fn(), startDragging: vi.fn(),
    isMaximized: vi.fn(), onResized: vi.fn(),
  },
  getCurrentWindow: vi.fn(),
}));
vi.mock("@/lib/transport", () => mocks.mode);
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: mocks.getCurrentWindow }));
import { performWindowAction, watchWindowMaximized } from "./native-window";

const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.mode.isWeb = false;
  mocks.getCurrentWindow.mockReturnValue(mocks.native);
  mocks.native.isMaximized.mockResolvedValue(false);
  mocks.native.onResized.mockResolvedValue(vi.fn());
});

describe("native window boundary", () => {
  it.each(["minimize", "toggleMaximize", "startDragging"] as const)("routes %s through native API", async (action) => {
    await performWindowAction(action);
    expect(mocks.native[action]).toHaveBeenCalledOnce();
  });
  it("does not acquire native handles on web", async () => {
    mocks.mode.isWeb = true;
    await performWindowAction("minimize");
    watchWindowMaximized(vi.fn(), vi.fn())();
    expect(mocks.getCurrentWindow).not.toHaveBeenCalled();
  });
  it("propagates action errors to the UI", async () => {
    mocks.native.toggleMaximize.mockRejectedValue(new Error("denied"));
    await expect(performWindowAction("toggleMaximize")).rejects.toThrow("denied");
  });
  it("tracks OS resize and cleans up listeners", async () => {
    const stop = vi.fn();
    mocks.native.onResized.mockResolvedValue(stop);
    const change = vi.fn();
    const dispose = watchWindowMaximized(change, vi.fn());
    await tick();
    expect(change).toHaveBeenLastCalledWith(false);
    mocks.native.isMaximized.mockResolvedValue(true);
    mocks.native.onResized.mock.calls[0][0]();
    await tick();
    expect(change).toHaveBeenLastCalledWith(true);
    dispose();
    expect(stop).toHaveBeenCalledOnce();
  });
  it("disposes a subscription that finishes after unmount", async () => {
    const late = deferred<() => void>();
    const state = deferred<boolean>();
    mocks.native.onResized.mockReturnValue(late.promise);
    mocks.native.isMaximized.mockReturnValue(state.promise);
    const change = vi.fn();
    const dispose = watchWindowMaximized(change, vi.fn());
    dispose();
    const stop = vi.fn();
    late.resolve(stop);
    state.resolve(true);
    await tick();
    expect(stop).toHaveBeenCalledOnce();
    expect(change).not.toHaveBeenCalled();
  });
  it("ignores an older maximized query", async () => {
    const old = deferred<boolean>();
    mocks.native.isMaximized.mockReturnValueOnce(old.promise).mockResolvedValue(true);
    const change = vi.fn();
    const dispose = watchWindowMaximized(change, vi.fn());
    await tick();
    old.resolve(false);
    await tick();
    expect(change).toHaveBeenLastCalledWith(true);
    expect(change).not.toHaveBeenCalledWith(false);
    dispose();
  });
  it("reports listener registration failures", async () => {
    const error = new Error("listen denied");
    mocks.native.onResized.mockRejectedValue(error);
    const onError = vi.fn();
    const dispose = watchWindowMaximized(vi.fn(), onError);
    await tick();
    expect(onError).toHaveBeenCalledWith(error);
    dispose();
  });
  it("reports a missing native handle rather than throwing from the effect", () => {
    mocks.getCurrentWindow.mockImplementation(() => { throw new Error("unavailable"); });
    const onError = vi.fn();
    watchWindowMaximized(vi.fn(), onError)();
    expect(onError).toHaveBeenCalledOnce();
  });
  it("disables native chrome and grants only the new main-window actions", () => {
    const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
    // Upstream creates the window after state registration, not from static JSON.
    expect(config.app.windows).toBeUndefined();
    const native = readFileSync("src-tauri/src/lib.rs", "utf8");
    const settings = readFileSync("src-tauri/src/settings.rs", "utf8");
    expect(settings).toMatch(/fn default_titlebar\(\) -> String\s*\{\s*"internal"\.to_string\(\)/);
    expect(native.match(/WebviewWindowBuilder::new\(/g)).toHaveLength(1);
    expect(native).toContain('.decorations(!internal_titlebar)');
    expect(native).toContain('settings.titlebar != "native"');
    expect(native).toContain('settings::restart_app');
    const cap = JSON.parse(readFileSync("src-tauri/capabilities/default.json", "utf8"));
    expect(cap.windows).toEqual(["main"]);
    expect(cap.permissions).toContain("core:window:allow-minimize");
    expect(cap.permissions).toContain("core:window:allow-toggle-maximize");
    const schema = readFileSync("src-tauri/gen/schemas/desktop-schema.json", "utf8");
    expect(schema).toContain('"core:window:allow-minimize"');
    expect(schema).toContain('"core:window:allow-toggle-maximize"');
  });
});
