import { sessionKey, useChatStore } from "../store";
import { QuestionCard } from "./QuestionCard";

/**
 * Floating dock above the composer: the active session's pending
 * AskUserQuestion, lifted out of the scrolling timeline. The timeline keeps
 * only a placeholder record; the interactive card lives here so the user
 * always sees it without chasing the stream.
 */
export function QuestionDock() {
  const active = useChatStore((s) => s.active);
  const pending = useChatStore((s) => {
    if (!active) return null;
    const key = sessionKey(active.engine, active.sessionId, active.workspacePath);
    const messages = s.bySession[key]?.messages ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "question" && m.question?.status === "pending") return m;
    }
    return null;
  });
  if (!pending) return null;
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-2 rounded-xl border border-border-secondary bg-background-secondary-default px-3.5 py-3 shadow-lg">
        <QuestionCard message={pending} />
      </div>
    </div>
  );
}
