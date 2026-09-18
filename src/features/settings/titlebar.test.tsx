import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ platform: { IS_WINDOWS: true, isWeb: false }, getSettings: vi.fn() }));
vi.mock("@/lib/platform", () => mocks.platform);
vi.mock("@/lib/ipc", () => ({ ipc: { getAppSettings: mocks.getSettings } }));
import { resolveTitlebarStyle, needsWindowControls, useTitlebarStyle } from "./titlebar";
it("keeps internal chrome as the default, with native/mac opt-in", () => {
  expect(resolveTitlebarStyle(undefined)).toBe("internal");
  expect(resolveTitlebarStyle("invalid")).toBe("internal");
  expect(resolveTitlebarStyle("native")).toBe("native");
  expect(resolveTitlebarStyle("mac")).toBe("mac");
  expect(needsWindowControls("internal")).toBe(false);
  expect(needsWindowControls("native")).toBe(false);
  expect(needsWindowControls("mac")).toBe(true);
  mocks.platform.isWeb = true;
  expect(needsWindowControls("mac")).toBe(false);
  mocks.platform.isWeb = false;
  mocks.platform.IS_WINDOWS = false;
  expect(resolveTitlebarStyle("mac")).toBe("internal");
  expect(needsWindowControls("mac")).toBe(false);
  mocks.platform.IS_WINDOWS = true;
});
it("does not switch window controls when settings are saved before restart, even after remount", async () => {
  mocks.getSettings.mockResolvedValue({ titlebar: "internal" });
  const host = document.createElement("div"); document.body.appendChild(host);
  let root = createRoot(host);
  function Mode() { return <span>{useTitlebarStyle()}</span>; }
  try {
    await act(async () => root.render(<Mode />));
    expect(host.textContent).toBe("internal");
    mocks.getSettings.mockResolvedValue({ titlebar: "mac" });
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(<Mode />));
    expect(host.textContent).toBe("internal");
    expect(mocks.getSettings).toHaveBeenCalledOnce();
  } finally { await act(async () => root.unmount()); host.remove(); }
});
