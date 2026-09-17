import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { menuPopoverSurface } from "./menu-styles";

it.each([
  ["permission-menu.tsx", "PERMISSION_POPOVER", "w-[323px]", "rounded-[20px]", "p-1.5"],
  ["ai-chat-composer.tsx", "CONTEXT_POPOVER_CLASSES", "w-[340px]", "rounded-2xl", "p-2"],
])("connects %s to the shared glass recipe", (file, constant, width, radius, padding) => {
  const source = readFileSync(`src/components/application/ai-chat/${file}`, "utf8");
  const match = source.match(new RegExp(`const ${constant} = menuPopoverSurface\\(\\{([\\s\\S]*?)\\}\\);`));
  expect(match).not.toBeNull();
  const options = Object.fromEntries([...match![1].matchAll(/(width|origin|radius|padding): "([^"]+)"/g)].map((m) => [m[1], m[2]]));
  const classes = menuPopoverSurface({ width: options.width, origin: options.origin, radius: options.radius, padding: options.padding }).split(/\s+/);
  for (const name of [width, radius, padding, "chat-glass-surface", "bg-transparent"]) expect(classes).toContain(name);
  expect(classes).not.toContain("relative");
  expect(classes).not.toContain("overflow-hidden");
  expect(source).toContain(`className={${constant}}`);
});
