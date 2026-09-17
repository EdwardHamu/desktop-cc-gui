import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const css = readFileSync("src/styles/globals.css", "utf8");
it("shares the cached glass pseudo-layer with div alerts only", () => {
  expect(css).toMatch(/\.chat-glass-surface,\s*div\[role="alert"\]\s*\{[^}]*isolation: isolate;/);
  const layer = css.match(/\.chat-glass-surface::before,\s*div\[role="alert"\]::before\s*\{([^}]+)\}/)?.[1];
  expect(layer).toContain("background-image: var(--glass-wallpaper-image, none)");
  expect(layer).toContain("pointer-events: none");
  expect(layer).toContain("border-radius: inherit");
  expect([...layer!.matchAll(/backdrop-filter:\s*([^;]+);/g)].every((match) => match[1].trim() === "none")).toBe(true);
});
it("sets the alert positioning fallback in base so sticky utilities remain effective", () => {
  expect(css).toMatch(/@layer base\s*\{\s*div\[role="alert"\]\s*\{ position: relative; \}/);
});
