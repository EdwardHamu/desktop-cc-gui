import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { blurGlassPixels, boundedBitmapSize, wallpaperRect } from "./glass-bitmap";

describe("cached glass geometry and pixels", () => {
  it("bounds both raw and viewport bitmaps without allocating at device DPR", () => {
    expect(boundedBitmapSize(3840, 2160)).toEqual({ width: 1600, height: 900, scale: 1600 / 3840 });
    expect(boundedBitmapSize(900, 1400).height).toBe(1400);
    expect(boundedBitmapSize(0, 0)).toMatchObject({ width: 1, height: 1 });
  });
  it.each([
    ["cover", { x: -300, y: 0, width: 1200, height: 600 }],
    ["contain", { x: 0, y: 150, width: 600, height: 300 }],
    ["center", { x: -700, y: -200, width: 2000, height: 1000 }],
    ["fill", { x: 0, y: 0, width: 600, height: 600 }],
  ] as const)("preserves centered %s geometry", (fit, expected) => {
    expect(wallpaperRect(2000, 1000, 600, 600, fit, 0)).toEqual(expected);
  });
  it("includes the original wallpaper blur overscan", () => {
    expect(wallpaperRect(600, 600, 600, 600, "cover", 10)).toEqual({ x: -30, y: -30, width: 660, height: 660 });
  });
  it("preserves a constant opaque color even at image edges", () => {
    const pixels = new Uint8ClampedArray(4 * 6).map((_, i) => [90, 90, 90, 255][i % 4]);
    expect(blurGlassPixels(pixels, 3, 2, 2)).toEqual(pixels);
  });
  it("blurs a point without modifying the source or introducing alpha", () => {
    const pixels = new Uint8ClampedArray(4 * 7);
    for (let i = 0; i < 7; i++) pixels[i * 4 + 3] = 255;
    pixels.set([255, 255, 255, 255], 12);
    const original = pixels.slice();
    const result = blurGlassPixels(pixels, 7, 1, 1);
    expect(result[12]).toBeLessThan(255);
    expect(result[8]).toBeGreaterThan(0);
    expect(result.filter((_, i) => i % 4 === 3)).toEqual(new Uint8ClampedArray(7).fill(255));
    expect(pixels).toEqual(original);
  });
  it("leaves no live backdrop filters in the shared CSS and loading overlay", () => {
    const css = readFileSync("src/styles/globals.css", "utf8");
    const values = [...css.matchAll(/(?:-webkit-)?backdrop-filter:\s*([^;]+);/g)].map((m) => m[1]);
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((value) => value === "none")).toBe(true);
    expect(css).toContain("background-image: var(--glass-wallpaper-image, none)");
    expect(readFileSync("src/features/settings/CliConfigBody.tsx", "utf8")).not.toContain("backdrop-blur-");
  });
});
