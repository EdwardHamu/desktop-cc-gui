import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CompletionNotificationSettings } from "./CompletionNotificationSettings";
import type { AppSettings } from "@/lib/ipc";
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/base/switch/switch", () => ({ Switch: (p: {
  isSelected: boolean; isDisabled: boolean; onChange: (value: boolean) => void; "aria-label": string;
}) => <input type="checkbox" aria-label={p["aria-label"]} checked={p.isSelected} disabled={p.isDisabled}
  onChange={(e) => p.onChange(e.target.checked)} /> }));
let container: HTMLDivElement;
let root: Root;
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const checkbox = (name: string) => container.querySelector<HTMLInputElement>(`[aria-label="completionNotifications.${name}"]`)!;
it("defaults both independent switches off for old settings", async () => {
  await act(async () => root.render(<CompletionNotificationSettings settings={{} as AppSettings} onSave={vi.fn()} />));
  expect(checkbox("toast").checked).toBe(false);
  expect(checkbox("sound").checked).toBe(false);
});
it("persists only the changed field and preserves the other switch", async () => {
  const save = vi.fn();
  function Host() {
    const [settings, set] = useState({ sessionCompletionToast: false, sessionCompletionSound: true } as AppSettings);
    return <CompletionNotificationSettings settings={settings} onSave={async (patch) => { save(patch); set(s => ({ ...s, ...patch })); }} />;
  }
  await act(async () => root.render(<Host />));
  await act(async () => checkbox("toast").click());
  expect(save).toHaveBeenLastCalledWith({ sessionCompletionToast: true });
  expect(checkbox("toast").checked).toBe(true);
  expect(checkbox("sound").checked).toBe(true);
  await act(async () => checkbox("sound").click());
  expect(save).toHaveBeenLastCalledWith({ sessionCompletionSound: false });
  expect(checkbox("toast").checked).toBe(true);
});
it("disables both controls while a save is pending without optimistic false success", async () => {
  let finish!: () => void;
  const save = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  await act(async () => root.render(<CompletionNotificationSettings settings={{} as AppSettings} onSave={save} />));
  await act(async () => checkbox("toast").click());
  expect(checkbox("toast").disabled).toBe(true);
  expect(checkbox("sound").disabled).toBe(true);
  expect(checkbox("toast").checked).toBe(false);
  await act(async () => { finish(); });
  expect(checkbox("toast").disabled).toBe(false);
});
