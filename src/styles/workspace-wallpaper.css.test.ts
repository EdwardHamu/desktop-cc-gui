import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("workspace wallpaper styles", () => {
  it("loads after shell / messages / composer fills so translucency wins", () => {
    const bootstrap = readFileSync(
      resolve(process.cwd(), "src/bootstrap.ts"),
      "utf8",
    );
    const wallpaperImport = bootstrap.indexOf(
      'import "./styles/workspace-wallpaper.css"',
    );
    const firstRunImport = bootstrap.indexOf(
      'import "./styles/first-run-setup.css"',
    );
    const mainImport = bootstrap.indexOf('import "./styles/main.css"');
    const messagesImport = bootstrap.indexOf('import "./styles/messages.css"');
    const composerImport = bootstrap.indexOf('import "./styles/composer.css"');

    expect(wallpaperImport).toBeGreaterThan(-1);
    expect(wallpaperImport).toBeGreaterThan(firstRunImport);
    expect(wallpaperImport).toBeGreaterThan(mainImport);
    expect(wallpaperImport).toBeGreaterThan(messagesImport);
    expect(wallpaperImport).toBeGreaterThan(composerImport);
  });

  it("uses one transparent pseudo-element glass treatment for chat chrome", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/workspace-wallpaper.css"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    const mainCss = readFileSync(
      resolve(process.cwd(), "src/styles/main.css"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    const statusCss = readFileSync(
      resolve(process.cwd(), "src/styles/messages.status-shell.css"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    const globalsCss = readFileSync(
      resolve(process.cwd(), "src/styles/globals.css"),
      "utf8",
    ).replace(/\r\n/g, "\n");

    expect(css).toContain("@supports ((backdrop-filter: blur(1px))");
    expect(css).toContain(":root[data-workspace-wallpaper] :is(");
    expect(css).toContain(":root[data-workspace-wallpaper] .app :is(");
    expect(css).not.toContain(".app:not(.reduced-transparency)");
    expect(css).toContain(".chat-input-box-wrapper,");
    expect(css).toContain(".messages-full,");
    expect(css).toContain(".main-topbar,");
    expect(css).toContain(".right-panel-top");
    expect(css).toContain("background: transparent;");
    expect(css).toContain("isolation: isolate;");
    expect(css).toContain("border: 1px solid #ffffff24;");
    expect(css).toContain("pointer-events: none;");
    expect(css).toContain("backdrop-filter: blur(10px) saturate(125%);");
    expect(css).toContain("-webkit-backdrop-filter: blur(10px) saturate(125%);");
    expect(css).toContain(":is(.messages, .composer, .right-panel)");
    expect(css).toContain(
      ':root[data-platform="windows"][data-workspace-wallpaper="fluid"]',
    );
    const mainTopbarRule = mainCss.match(/\.main-topbar\s*\{([\s\S]*?)\n\}/)?.[1];
    expect(mainTopbarRule).toBeDefined();
    expect(mainTopbarRule).not.toContain("backdrop-filter");
    const rightPanelRule = mainCss.match(/\.right-panel\s*\{([\s\S]*?)\n\}/)?.[1];
    expect(rightPanelRule).toBeDefined();
    expect(rightPanelRule).toContain("border-left: none;");
    expect(statusCss).toContain("animation: working-dash 2.5s steps(10, end) infinite;");
    expect(globalsCss).toContain(
      "animation: proxy-badge-halo 2.5s steps(10, end) infinite;",
    );
    expect(globalsCss).toContain(
      "transition: opacity 200ms steps(6, end), transform 200ms steps(6, end);",
    );
  });

  it("punches through the solid conversation and chrome fills", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/workspace-wallpaper.css"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    expect(css).toContain(":root[data-workspace-wallpaper] .sidebar");
    expect(css).toContain(":root[data-workspace-wallpaper] .main");
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .app.reduced-transparency .main",
    );
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .app.reduced-transparency .sidebar",
    );
    expect(css).toContain("background: var(--workspace-wallpaper-veil);");
    expect(css).toContain("--desktop-main-radius: 0;");
    expect(css).not.toContain(
      ":root[data-workspace-wallpaper] .app.layout-desktop .sidebar {\n  border-right",
    );
    expect(css).toContain(":root[data-workspace-wallpaper] .messages");
    expect(css).toContain(":root[data-workspace-wallpaper] .right-panel");
    expect(css).toContain(":root[data-workspace-wallpaper] .composer");
    expect(css).toContain(":root[data-workspace-wallpaper] .terminal-panel");
    expect(css).toContain(":root[data-workspace-wallpaper] .terminal-surface");
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .terminal-surface .xterm",
    );
    expect(css).toContain("--terminal-background: transparent;");
    expect(css).toContain(":root[data-workspace-wallpaper] .fvp");
    expect(css).toContain("--workspace-wallpaper-veil:");
    expect(css).toContain(
      ":root[data-workspace-wallpaper] {\n  --workspace-wallpaper-frost: 0px;\n  --desktop-main-radius: 0;\n  --desktop-main-shadow: none;\n}",
    );
    expect(css).not.toContain(
      "--workspace-wallpaper-wash-opacity: 8%;\n  --workspace-wallpaper-frost:",
    );
    expect(css).not.toContain(
      "backdrop-filter: blur(var(--workspace-wallpaper-frost",
    );
    expect(css).toContain(
      ':root[data-platform="windows"] .workspace-wallpaper::after',
    );
    expect(css).toContain(".workspace-wallpaper::after");
    expect(css).toContain(".workspace-wallpaper::before");
    expect(css).toContain("--workspace-wallpaper-media-blur");
    expect(css).toContain("--workspace-wallpaper-darken");
    expect(css).toContain("--workspace-wallpaper-object-fit");
    expect(css).toContain("--workspace-wallpaper-flip");
    expect(css).toContain("backdrop-filter: none;");
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .app {\n  position: relative;\n  z-index: 1;\n}",
    );
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .sidebar,\n:root[data-workspace-wallpaper] .compact-panel {\n  z-index: 1;\n}",
    );
    expect(css).toContain("border-radius: 0 !important;");
    expect(css).toContain("prefers-reduced-transparency");
    expect(css).toContain(".app.reduced-transparency");
    expect(css).toContain("color-mix(");
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .app.reduced-transparency .main",
    );
    expect(css).not.toContain("var(--workspace-wallpaper-veil-opacity");
    expect(css).not.toContain("var(--workspace-wallpaper-veil) 58%");
    expect(css).not.toContain(
      "color-mix(in srgb, var(--surface-topbar) 42%, transparent)",
    );
    expect(css).not.toContain(
      "color-mix(in srgb, var(--surface-right-panel) 28%, transparent)",
    );
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .drag-strip {\n  pointer-events: none;\n}",
    );
    expect(css).toContain(".home-titlebar-drag-strip");
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .home-titlebar-drag-strip {\n  pointer-events: auto;\n}",
    );
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .settings-embedded",
    );
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .main.settings-open > .settings-embedded",
    );
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .settings-content-wrap",
    );
    expect(css).toContain(
      ":root[data-workspace-wallpaper][data-theme=\"light\"] .settings-sidebar",
    );
    expect(css).not.toContain(
      "background: color-mix(in srgb, #ffffff 72%, transparent);",
    );
    expect(css).not.toContain(
      "background: color-mix(in srgb, #ffffff 78%, transparent);",
    );
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .settings-embedded :is(",
    );
    expect(css).toContain(".settings-basic-group-card,");
    expect(css).toContain(".vendor-group-card,");
    expect(css).toContain(".settings-project-row,");
    expect(css).toContain(".settings-shortcuts-detail,");
    expect(css).toContain(".settings-toggle-row,");
    expect(css).toContain(
      "--settings-wallpaper-card: color-mix(in srgb, #ffffff 34%, transparent);",
    );
    expect(css).toContain(
      "--settings-wallpaper-card: color-mix(in srgb, #121214 22%, transparent);",
    );
    expect(css).toContain("backdrop-filter: blur(22px) saturate(1.28);");
    expect(css).toContain(
      ':root[data-platform="windows"][data-workspace-wallpaper] .settings-embedded :is(',
    );
    expect(css).toContain("--message-inline-code-bg: color-mix(");
    expect(css).toContain("var(--workspace-wallpaper-wash, #ededf0) 30%");
    expect(css).toContain(".app .messages-full {");
    expect(css).toContain("border-radius: 12px;");
    expect(css).toContain("padding-inline: 10px;");
    expect(css).toContain(".chat-input-box *::before");
    expect(css).toContain("border: none !important;");
    expect(css).toContain(".context-dual-tooltip,");
    expect(css).toContain("[data-radix-popper-content-wrapper],");
    expect(css).toContain("[data-radix-menu-content]");
    expect(css).toContain(".sidebar-workspace-menu");
    expect(css).toContain("[data-radix-menu-content] *::before");
    expect(css).toContain("background: transparent !important;");
    expect(css).toContain(
      "[data-radix-menu-content][data-radix-menu-content]",
    );
    expect(css).toContain("background-color: transparent !important;");
    expect(css).toContain(".button-area-right :is(button, [role=\"button\"])");
    expect(css).toContain("currentColor 30%");
    expect(css).toContain(".messages-full .message.user .message-bubble");
    expect(css).not.toContain('[data-slot="table-container"]');
    expect(css).toContain(
      ":root[data-workspace-wallpaper] :is(.message, .thinking-block) .markdown-codeblock",
    );
    expect(css).toContain(
      ":root[data-workspace-wallpaper] :is(.message, .thinking-block) .markdown :not(pre) > code",
    );
    expect(css).not.toContain(
      ":root[data-workspace-wallpaper] :is(.message, .thinking-block) .markdown-codeblock {\n  backdrop-filter:",
    );
  });

  it("keeps opaque markdown code surfaces when wallpaper is off", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/messages.part2.css"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    expect(css).toContain("--message-inline-code-bg: var(--muted);");
    expect(css).toContain("--message-codeblock-bg: var(--muted);");
    expect(css).not.toContain("data-workspace-wallpaper");
  });

  it("allows Tauri asset.localhost previews in CSP", () => {
    const csp = JSON.parse(
      readFileSync(resolve(process.cwd(), "src-tauri/tauri.conf.json"), "utf8"),
    ).app.security.csp as string;
    expect(csp).toContain("http://asset.localhost");
    expect(csp).toContain("https://asset.localhost");
    expect(csp).toContain("img-src");
    expect(csp).toContain(
      "media-src 'self' asset: data: blob: http://asset.localhost https://asset.localhost",
    );
  });
});
