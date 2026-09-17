import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("sets proxy state color on the SVG instead of inheriting button text color", () => {
  const source = readFileSync("src/components/application/ai-chat/ai-chat-composer.tsx", "utf8");
  const globe = source.match(/<Globe\s[\s\S]*?\/>/)?.[0];
  expect(globe).toContain('style={{ color: enabled ? "var(--color-notification-success-foreground)" : "var(--color-foreground-icon-tertiary)" }}');
  expect(source).toContain("aria-pressed={enabled}");
});
