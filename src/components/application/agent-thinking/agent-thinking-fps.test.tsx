import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { AgentThinking } from "./agent-thinking";
import { STATUS_FRAME_MS, statusStepEnd } from "@/utils/status-animation";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10000);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each(["wave", "spin"] as const)("samples %s only at 200ms boundaries without opacity interpolation", (variant) => {
  act(() => root.render(<AgentThinking label="Thinking" variant={variant} showTimer={false} />));
  const snapshot = () => [...host.querySelectorAll<HTMLElement>(".grid > span")].map((el) => el.style.opacity).join(",");
  let previous = snapshot();
  for (let frame = 0; frame < 5; frame++) {
    act(() => vi.advanceTimersByTime(199));
    expect(snapshot()).toBe(previous);
    act(() => vi.advanceTimersByTime(1));
    expect(snapshot()).not.toBe(previous);
    previous = snapshot();
  }
  for (const dot of host.querySelectorAll<HTMLElement>(".grid > span")) expect(dot.style.transition).toBe("none");
  act(() => root.render(null));
  expect(vi.getTimerCount()).toBe(0);
});

it("refreshes elapsed time every 200ms and still uses wall time", () => {
  act(() => root.render(<AgentThinking label="Thinking" variant="stars" startedAt={8000} />));
  expect(host.textContent).toContain("2.0s");
  act(() => vi.advanceTimersByTime(199));
  expect(host.textContent).toContain("2.0s");
  act(() => vi.advanceTimersByTime(1));
  expect(host.textContent).toContain("2.2s");
});

it("does not run the dot timer for reduced motion", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  act(() => root.render(<AgentThinking label="Thinking" showTimer={false} />));
  expect(vi.getTimerCount()).toBe(0);
});

it("aligns staggered stars to the same 200ms frame grid", () => {
  act(() => root.render(<AgentThinking label="Thinking" variant="stars" showTimer={false} />));
  const stars = [...host.querySelectorAll<SVGElement>(".bui-agent-thinking-star")];
  expect(stars.map((el) => el.style.animationDelay)).toEqual(["0ms", "200ms", "400ms", "600ms", "800ms"]);
  expect(stars.every((el) => el.style.animationDuration === "1.4s")).toBe(true);
});

it("uses five samples per second for CSS timelines, not five steps per keyframe segment", () => {
  const css = readFileSync("src/styles/globals.css", "utf8").replace(/\r\n/g, "\n");
  expect(css).toContain("ai-chat-text-shimmer 2.6s steps(13, end)");
  expect(css).toContain("animation-timing-function: steps(6, end)");
  expect(css).toContain("sidebar-thread-status-heartbeat 1s step-end infinite");
  const star = css.match(/@keyframes bui-agent-thinking-star \{([\s\S]*?)\n\}/)![1];
  const positions = [...star.matchAll(/([\d.]+)%/g)].map((m) => Number(m[1]));
  expect(positions).toHaveLength(8);
  for (let i = 1; i < positions.length; i++) expect((positions[i] - positions[i - 1]) * 14).toBeCloseTo(200, 3);
  expect(css).toContain(".sidebar-thread-status-processing {\n    animation: none;");
});

it("holds the short status-toast animation until its 200ms final frame", () => {
  expect(STATUS_FRAME_MS).toBe(200);
  expect([0, 0.1, 0.5, 0.99].map(statusStepEnd)).toEqual([0, 0, 0, 0]);
  expect(statusStepEnd(1)).toBe(1);
});
