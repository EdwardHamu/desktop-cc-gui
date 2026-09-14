import { describe, expect, it } from "vitest";
import { listExternalSessionMetas, registerSessionSource, type ExternalSessionRow } from "./session-source";

const row = (sessionId: string, workspacePath = "~/cxn", engine = "codex") => ({
  engine,
  sessionId,
  workspacePath,
  title: `t-${sessionId}`,
  updatedAt: 1000,
});

describe("session source registry", () => {
  it("merges rows from registered sources and fills SessionMeta defaults", async () => {
    const dispose = registerSessionSource("wsl", "main", async () => [row("s-1")]);
    const metas = await listExternalSessionMetas();
    expect(metas).toHaveLength(1);
    expect(metas[0]).toMatchObject({
      engine: "codex",
      sessionId: "s-1",
      workspacePath: "~/cxn",
      title: "t-s-1",
      pinned: false,
      customTitle: null,
      updatedAt: 1000,
    });
    dispose();
    expect(await listExternalSessionMetas()).toHaveLength(0);
  });

  it("re-registering the same source id replaces it (hot reload)", async () => {
    const d1 = registerSessionSource("wsl", "main", async () => [row("s-1")]);
    const d2 = registerSessionSource("wsl", "main", async () => [row("s-2")]);
    d1();
    const metas = await listExternalSessionMetas();
    expect(metas.map((m) => m.sessionId)).toEqual(["s-2"]);
    d2();
  });

  it("a throwing source is isolated, rows without workspacePath are dropped", async () => {
    const d1 = registerSessionSource("bad", "src", async () => {
      throw new Error("ssh down");
    });
    const d2 = registerSessionSource("wsl", "src", async () => [
      row("s-1"),
      // 缺 workspacePath 的行(类型违规输入,运行时须被丢弃)。
      { engine: "omp", sessionId: "x" } as unknown as ExternalSessionRow,
    ]);
    const metas = await listExternalSessionMetas();
    expect(metas.map((m) => m.sessionId)).toEqual(["s-1"]);
    d1();
    d2();
  });
});
