import React, { useState } from "react";
import { createRequire } from "node:module";
import { expect, it } from "vitest";

// ReactDOM is CommonJS. Its React and Vite's ESM import must be the same
// singleton even when Windows launch paths differ in drive-letter case.
const require = createRequire(import.meta.url);
const rendererRequire = createRequire(require.resolve("react-dom"));

it("shares the React singleton between ESM components and the CommonJS renderer", () => {
  const rendererReact = rendererRequire("react") as typeof React;
  expect(useState).toBe(rendererReact.useState);
  expect(React).toBe(rendererReact);
});
