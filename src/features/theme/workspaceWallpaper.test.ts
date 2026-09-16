import { describe, expect, it } from "vitest";
import {
  cssObjectFit,
  DEFAULT_WORKSPACE_WALLPAPER,
  fileExtension,
  isSupportedWallpaperMedia,
  isVideoWallpaper,
  resolveWorkspaceWallpaper,
  sanitizeWallpaperBlur,
  sanitizeWallpaperDarken,
  wallpaperFileName,
} from "./workspaceWallpaper";

describe("sanitizers", () => {
  it("clamps blur into range and rounds", () => {
    expect(sanitizeWallpaperBlur(-5)).toBe(0);
    expect(sanitizeWallpaperBlur(999)).toBe(40);
    expect(sanitizeWallpaperBlur(12.4)).toBe(12);
  });

  it("falls back on non-finite input", () => {
    expect(sanitizeWallpaperBlur(Number.NaN)).toBe(0);
    expect(sanitizeWallpaperBlur(Number.POSITIVE_INFINITY)).toBe(0);
    expect(sanitizeWallpaperDarken(undefined)).toBe(0);
    expect(sanitizeWallpaperDarken("nope")).toBe(0);
  });

  it("clamps darken to its own max", () => {
    expect(sanitizeWallpaperDarken(120)).toBe(80);
  });
});

describe("path helpers", () => {
  it("reads extensions on both path separators", () => {
    expect(fileExtension("C:\\media\\a.PNG")).toBe("png");
    expect(fileExtension("/home/u/b.mp4")).toBe("mp4");
    expect(fileExtension("/home/u/noext")).toBe("");
    expect(fileExtension("/home/u/.hidden")).toBe("");
  });

  it("extracts the file name", () => {
    expect(wallpaperFileName("C:\\media\\a.png")).toBe("a.png");
    expect(wallpaperFileName("/home/u/b.mp4")).toBe("b.mp4");
  });

  it("classifies media kinds", () => {
    expect(isVideoWallpaper("/x/a.mp4")).toBe(true);
    expect(isVideoWallpaper("/x/a.png")).toBe(false);
    expect(isVideoWallpaper(null)).toBe(false);
    expect(isSupportedWallpaperMedia("/x/a.webp")).toBe(true);
    expect(isSupportedWallpaperMedia("/x/a.txt")).toBe(false);
  });
});

describe("cssObjectFit", () => {
  it("maps center to none and passes the rest through", () => {
    expect(cssObjectFit("center")).toBe("none");
    expect(cssObjectFit("cover")).toBe("cover");
    expect(cssObjectFit("contain")).toBe("contain");
  });
});

describe("resolveWorkspaceWallpaper", () => {
  it("returns defaults for null/undefined", () => {
    expect(resolveWorkspaceWallpaper(null)).toEqual(DEFAULT_WORKSPACE_WALLPAPER);
    expect(resolveWorkspaceWallpaper(undefined)).toEqual(DEFAULT_WORKSPACE_WALLPAPER);
  });

  it("keeps a valid custom wallpaper", () => {
    const out = resolveWorkspaceWallpaper({
      mode: "custom",
      mediaPath: "/home/u/bg.jpg",
      blur: 10,
      darken: 30,
      objectFit: "contain",
      paused: true,
    });
    expect(out.mode).toBe("custom");
    expect(out.mediaPath).toBe("/home/u/bg.jpg");
    expect(out.blur).toBe(10);
    expect(out.darken).toBe(30);
    expect(out.objectFit).toBe("contain");
    expect(out.paused).toBe(true);
  });

  it("downgrades custom mode when media is missing or unsupported", () => {
    expect(resolveWorkspaceWallpaper({ mode: "custom", mediaPath: null }).mode).toBe("none");
    expect(resolveWorkspaceWallpaper({ mode: "custom", mediaPath: "   " }).mode).toBe("none");
    expect(resolveWorkspaceWallpaper({ mode: "custom", mediaPath: "/x/a.txt" }).mode).toBe("none");
  });

  it("drops the legacy fluid mode to none", () => {
    // Pre-rebase configs may still carry mode "fluid"; it is no longer a
    // supported mode, so it must not leak through as a custom wallpaper.
    const out = resolveWorkspaceWallpaper({ mode: "fluid" as never, mediaPath: "/x/a.png" });
    expect(out.mode).toBe("none");
  });

  it("repairs out-of-range and malformed fields", () => {
    const out = resolveWorkspaceWallpaper({
      mode: "custom",
      mediaPath: "/x/a.png",
      blur: 9999,
      darken: -4,
      objectFit: "bogus" as never,
      paused: "yes" as never,
    });
    expect(out.blur).toBe(40);
    expect(out.darken).toBe(0);
    expect(out.objectFit).toBe("cover");
    expect(out.paused).toBe(false);
  });
});
