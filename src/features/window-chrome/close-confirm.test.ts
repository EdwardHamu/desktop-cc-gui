import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  mode: { isWeb: false }, destroy: vi.fn(), onCloseRequested: vi.fn(),
}));
vi.mock("@/lib/transport", () => mocks.mode);
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => mocks }));
import { requestAppClose, closeConfirmPending, cancelAppClose, confirmAppClose, subscribeCloseConfirm } from "@/lib/close-confirm";
beforeEach(() => {
  cancelAppClose();
  mocks.mode.isWeb = false;
  vi.clearAllMocks();
  mocks.destroy.mockResolvedValue(undefined);
});
it("requests confirmation even before native listener setup, cancelling never destroys", () => {
  const changed = vi.fn();
  const stop = subscribeCloseConfirm(changed);
  requestAppClose();
  requestAppClose();
  expect(closeConfirmPending()).toBe(true);
  expect(changed).toHaveBeenCalledOnce();
  expect(mocks.destroy).not.toHaveBeenCalled();
  cancelAppClose();
  expect(closeConfirmPending()).toBe(false);
  expect(mocks.destroy).not.toHaveBeenCalled();
  stop();
});
it("destroys only when the existing confirmation is accepted", () => {
  requestAppClose();
  confirmAppClose();
  expect(mocks.destroy).toHaveBeenCalledOnce();
  expect(closeConfirmPending()).toBe(false);
});
it("does not request desktop close in browser mode", () => {
  mocks.mode.isWeb = true;
  requestAppClose();
  expect(closeConfirmPending()).toBe(false);
  expect(mocks.destroy).not.toHaveBeenCalled();
});
