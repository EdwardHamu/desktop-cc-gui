import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles/globals.css", "utf8");
const surfaces = css.slice(css.indexOf("/* Timeline display surfaces:"));
const rules = [...surfaces.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]+)\}/g)];

describe("timeline background alpha policy", () => {
  it("only changes backgrounds on timeline descendants, never whole-element opacity", () => {
    expect(rules).toHaveLength(9);
    for (const [, selector, body] of rules) {
      expect(selector.trim().startsWith("[data-virtual-inner] ")).toBe(true);
      expect(body.trim()).toMatch(/^background-(color|image):/);
      expect(body).not.toMatch(/(?:^|[;\s])opacity\s*:/);
      expect(body).toMatch(/30%|0\.3/);
    }
  });

  it("covers bubble/fade, white chips, diff colors, indicators and image backdrop", () => {
    for (const name of [".bg-bubble-user", ".from-bubble-user", "bg-white/15", "bg-white/20", "bg-white/25", "hover:bg-white/40", "bg-emerald-500/10", "bg-red-500/10", "bg-red-500/5", ".bg-current", ".bg-overlay-backdrop"]) {
      expect(surfaces).toContain(name);
    }
    expect(surfaces).toContain("rgb(255 255 255 / 0.3)");
    expect(surfaces).toContain("rgb(0 0 0 / 0.3)");
  });

  it("leaves transparent theme backgrounds transparent", () => {
    const theme = readFileSync("src/styles/theme.css", "utf8");
    const backgrounds = [...theme.matchAll(/--[\w-]*background[\w-]*:\s*([^;]+);/g)];
    expect(backgrounds).toHaveLength(94);
    for (const [, color] of backgrounds) expect(color).toBe("transparent");
    expect(surfaces).not.toMatch(/--color-background-[\w-]+\s*:/);
    expect(surfaces).toContain("var(--color-background-secondary-hover) 30%, transparent");
  });
});
