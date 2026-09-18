import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mode: { isWeb: false, titlebar: "internal" as "internal" | "native" | "mac" },
  perform: vi.fn(), watch: vi.fn(), requestClose: vi.fn(),
}));
vi.mock("@/lib/transport", () => mocks.mode);
vi.mock("@/features/settings/titlebar", () => ({ useTitlebarStyle: () => mocks.mode.titlebar }));
vi.mock("./native-window", () => ({ performWindowAction: mocks.perform, watchWindowMaximized: mocks.watch }));
vi.mock("@/lib/close-confirm", () => ({ requestAppClose: mocks.requestClose }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
import { WindowTitleBar } from "./WindowTitleBar";

let host: HTMLDivElement;
let root: Root;
let stop: ReturnType<typeof vi.fn>;
const button = (key: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="windowTitleBar.${key}"]`)!;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.mode.isWeb = false;
  mocks.mode.titlebar = "internal";
  mocks.perform.mockResolvedValue(undefined);
  stop = vi.fn();
  mocks.watch.mockReturnValue(stop);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
const mount = async () => { await act(async () => root.render(<WindowTitleBar />)); };
it.each(["native", "mac"] as const)("does not duplicate chrome in %s mode", async (style) => {
  mocks.mode.titlebar = style;
  await mount();
  expect(host.childElementCount).toBe(0);
  expect(mocks.watch).not.toHaveBeenCalled();
});
const click = async (key: string) => { await act(async () => button(key).click()); };

describe("internal window titlebar", () => {
  it("renders nothing and never subscribes on web", async () => {
    mocks.mode.isWeb = true;
    await mount();
    expect(host.childElementCount).toBe(0);
    expect(mocks.watch).not.toHaveBeenCalled();
  });
  it("routes minimize/maximize and close without making buttons draggable", async () => {
    await mount();
    await click("minimize");
    await click("maximize");
    await click("close");
    expect(mocks.perform.mock.calls.map(([action]) => action)).toEqual(["minimize", "toggleMaximize"]);
    expect(mocks.requestClose).toHaveBeenCalledOnce();
    await act(async () => button("close").dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })));
    expect(mocks.perform).toHaveBeenCalledTimes(2);
  });
  it("drags on primary press and toggles on the second press, but ignores right clicks", async () => {
    await mount();
    const drag = host.querySelector("header > div")!;
    for (const [button, detail] of [[0, 1], [0, 2], [2, 1]]) {
      await act(async () => drag.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button, detail })));
    }
    expect(mocks.perform.mock.calls.map(([action]) => action)).toEqual(["startDragging", "toggleMaximize"]);
  });
  it("updates the restore label from native state and cleans up on unmount", async () => {
    await mount();
    await act(async () => mocks.watch.mock.calls[0][0](true));
    expect(button("restore")).not.toBeNull();
    await act(async () => root.render(null));
    expect(stop).toHaveBeenCalledOnce();
  });
  it("shows failures without hiding close or leaving controls busy", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.perform.mockRejectedValue(new Error("denied"));
    await mount();
    await click("minimize");
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("windowTitleBar.actionFailed");
    expect(button("minimize").disabled).toBe(false);
    expect(button("close").disabled).toBe(false);
  });
  it("prevents repeated operations while the first one is pending", async () => {
    let resolve!: () => void;
    mocks.perform.mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    await mount();
    await click("maximize");
    await click("maximize");
    expect(mocks.perform).toHaveBeenCalledOnce();
    await act(async () => resolve());
    expect(button("maximize").disabled).toBe(false);
  });
});
