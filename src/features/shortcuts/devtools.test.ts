import { beforeEach, afterAll, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => {}),
  isTauri: vi.fn(() => true),
}));
import { invoke, isTauri } from "@tauri-apps/api/core";
import { handleDevtoolsShortcut } from "./devtools";

const originalPlatform = navigator.platform;
function platform(value: string) {
  Object.defineProperty(navigator, "platform", { value, configurable: true });
}
afterAll(() => platform(originalPlatform));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isTauri).mockReturnValue(true);
  platform("Win32");
});
const key = (key: string, options: KeyboardEventInit = {}) =>
  new KeyboardEvent("keydown", { key, cancelable: true, ...options });

it.each([
  ["Win32", "F12", {}],
  ["Win32", "I", { ctrlKey: true, shiftKey: true }],
  ["Linux x86_64", "i", { ctrlKey: true, shiftKey: true }],
  ["MacIntel", "i", { metaKey: true, altKey: true }],
] as const)("opens devtools on %s with %s", (os, name, options) => {
  platform(os);
  const event = key(name, options);
  expect(handleDevtoolsShortcut(event)).toBe(true);
  expect(event.defaultPrevented).toBe(true);
  expect(invoke).toHaveBeenCalledWith("open_devtools");
});
it("leaves browser shortcuts untouched", () => {
  vi.mocked(isTauri).mockReturnValue(false);
  const event = key("F12");
  expect(handleDevtoolsShortcut(event)).toBe(false);
  expect(event.defaultPrevented).toBe(false);
  expect(invoke).not.toHaveBeenCalled();
});
it("consumes repeat without invoking again", () => {
  const event = key("F12", { repeat: true });
  expect(handleDevtoolsShortcut(event)).toBe(true);
  expect(event.defaultPrevented).toBe(true);
  expect(invoke).not.toHaveBeenCalled();
});
it("ignores IME, extra modifiers, unrelated keys and consumed events", () => {
  const consumed = key("F12");
  consumed.preventDefault();
  for (const event of [consumed, key("F12", { isComposing: true }),
    key("F12", { ctrlKey: true }), key("i", { ctrlKey: true }), key("a")]) {
    expect(handleDevtoolsShortcut(event)).toBe(false);
  }
  expect(invoke).not.toHaveBeenCalled();
});
it("reports IPC rejection without an unhandled promise", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(invoke).mockRejectedValueOnce(new Error("unavailable"));
  handleDevtoolsShortcut(key("F12"));
  await Promise.resolve();
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});
