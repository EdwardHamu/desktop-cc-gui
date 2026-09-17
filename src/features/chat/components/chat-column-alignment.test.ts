import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");
describe("chat column alignment", () => {
  it("uses the composer maximum width for the virtual message surface", () => {
    expect(source("./MessageTimeline.tsx")).toContain("chat-glass-surface mx-auto w-full max-w-3xl rounded-2xl");
    expect(source("./ConversationFooter.tsx")).toContain('className="mx-auto max-w-3xl"');
  });
  it("balances navigation and scrollbar space rather than shifting the center", () => {
    expect(source("./MessageAnchorRail.tsx")).toContain('MESSAGE_ANCHOR_RAIL_BAND_CLASS = "px-[72px]"');
    expect(source("./MessageTimeline.tsx")).toContain('[scrollbar-gutter:stable_both-edges]');
    expect(source("./MessageTimeline.tsx")).toContain('anchors.length > 0 ? MESSAGE_ANCHOR_RAIL_BAND_CLASS : "px-4"');
  });
  it("preserves the virtual rows' ten-pixel text insets", () => {
    expect(source("./MessageTimeline.tsx")).toMatch(/left: 10,\s+right: 10,/);
  });
});
