import { describe, expect, it } from "vitest";
import { MENU_POPOVER_SURFACE, menuPopoverSurface } from "./menu-styles";

describe("popover pseudo-element glass", () => {
  it("uses the shared transparent glass layer for dropdown and select popovers", () => {
    const classes = MENU_POPOVER_SURFACE.split(/\s+/);
    expect(classes).toContain("chat-glass-surface");
    expect(classes).toContain("bg-transparent");
    expect(classes).not.toContain("surface-frosted");
    expect(classes).toContain("overflow-y-auto");
    expect(classes).not.toContain("relative");
  });

  it("keeps caller geometry while replacing the old frosted surface", () => {
    const classes = menuPopoverSurface({
      width: "w-64",
      origin: "origin-bottom-left",
      radius: "rounded-lg",
      padding: "p-1.5",
    }).split(/\s+/);
    for (const name of ["chat-glass-surface", "bg-transparent", "w-64", "origin-bottom-left", "rounded-lg", "p-1.5"]) {
      expect(classes).toContain(name);
    }
    expect(classes).not.toContain("surface-frosted");
    expect(classes).not.toContain("relative");
    expect(classes).not.toContain("overflow-hidden");
  });
});
