import { afterEach, describe, expect, it } from "vitest";
import { terminalTheme } from "./appearance";

const originalClass = document.documentElement.className;
afterEach(() => {
  document.documentElement.className = originalClass;
});

describe("terminal transparency", () => {
  it.each([false, true])("keeps the default background transparent (dark=%s)", (dark) => {
    document.documentElement.classList.toggle("dark", dark);
    const theme = terminalTheme();
    expect(theme.background).toBe("rgba(0, 0, 0, 0)");
    expect(theme.foreground).toBe(dark ? "#e6e6e6" : "#1f2328");
    expect(theme.cursor).toBe(theme.foreground);
    expect(theme.selectionBackground).toBe(
      dark ? "rgba(255, 255, 255, 0.22)" : "rgba(0, 0, 0, 0.16)",
    );
  });
});
