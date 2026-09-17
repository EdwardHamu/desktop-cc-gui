import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { EngineFlyout } from "./engine-model-panel";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./effort-slider", () => ({ EffortSlider: () => <div /> }));

it("gives the model submenu shared glass without losing flyout geometry or model picking", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const pick = vi.fn();
  try {
    await act(async () => root.render(
      <EngineFlyout
        option={{ id: "claude", label: "Claude" }}
        models={[{ id: "model-a", label: "Model A" }]}
        selectedModelId="model-a"
        query=""
        onQueryChange={vi.fn()}
        effort="medium"
        onPickModel={pick}
        onEffortChange={vi.fn()}
        ompServiceTier="default"
        onOmpServiceTierChange={async () => {}}
        codexServiceTier="default"
        onCodexServiceTierChange={async () => {}}
      />,
    ));
    const flyout = host.firstElementChild as HTMLElement;
    for (const name of ["absolute", "left-full", "bottom-0", "z-10", "ml-2", "w-80", "rounded-lg", "p-1", "chat-glass-surface", "bg-transparent"]) {
      expect(flyout.classList.contains(name), name).toBe(true);
    }
    expect(flyout.classList.contains("relative")).toBe(false);
    expect(flyout.classList.contains("overflow-hidden")).toBe(false);
    expect(flyout.classList.contains("bg-background-primary-default")).toBe(false);
    expect(host.querySelector('[role="radiogroup"]')?.classList.contains("overflow-y-auto")).toBe(true);
    await act(async () => { host.querySelector<HTMLButtonElement>('[role="radio"]')!.click(); });
    expect(pick).toHaveBeenCalledWith("claude", "model-a");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
