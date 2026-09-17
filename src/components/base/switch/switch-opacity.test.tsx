import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { SwitchTrack } from "./switch";
let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it.each([false, true])("keeps an opaque thumb with selected=%s", async (isSelected) => {
  await act(async () => root.render(<SwitchTrack state={{ isSelected, isDisabled: false, isFocusVisible: false }} />));
  const track = host.firstElementChild!;
  expect(track.firstElementChild!.className).toContain("from-white");
  expect(track.firstElementChild!.className).toContain("to-neutral-50");
  if (isSelected) {
    expect(track.className).toContain("from-accent-500");
  } else {
    expect(track.className).toContain("bg-neutral-200");
    expect(track.className).toContain("dark:bg-neutral-700");
    expect(track.className).not.toContain("bg-background-tertiary-default");
  }
});
it("preserves disabled and keyboard focus styling", async () => {
  await act(async () => root.render(<SwitchTrack state={{ isSelected: false, isDisabled: true, isFocusVisible: true }} />));
  expect(host.firstElementChild!.className).toContain("opacity-50");
  expect(host.firstElementChild!.className).toContain("ring-border-focus-ring");
});
