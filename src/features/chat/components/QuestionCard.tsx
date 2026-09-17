import { useState } from "react";
import { useTranslation } from "react-i18next";
import Check from "lucide-react/dist/esm/icons/check";
import X from "lucide-react/dist/esm/icons/x";
import type { Message } from "@/lib/ipc";
import { sessionKey, useChatStore } from "../store";

/**
 * AskUserQuestion card (dock form): the CLI parked the question on the control
 * protocol (`can_use_tool`) and the turn only continues once it is answered
 * or skipped. Layout is question-first: prompt on top, options in a row below,
 * then a free-form "Other" input row. Answers are the chosen option labels —
 * that is the contract the CLI's question reader matches against; any other
 * non-empty string travels as a typed (free-form) answer.
 */
export function QuestionCard({ message }: { message: Message }) {
  const { t } = useTranslation();
  const respondToQuestion = useChatStore((s) => s.respondToQuestion);
  const active = useChatStore((s) => s.active);
  const key = active
    ? sessionKey(active.engine, active.sessionId, active.workspacePath)
    : "";
  const [picked, setPicked] = useState<Record<string, string | string[]>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const question = message.question;
  if (!question) return null;
  const { status, questions } = question;

  const pick = (text: string, label: string, multi: boolean) => {
    // An option pick replaces any typed answer for that question.
    setOther((cur) => ({ ...cur, [text]: "" }));
    setPicked((cur) => {
      if (!multi) return { ...cur, [text]: label };
      const list = Array.isArray(cur[text]) ? [...(cur[text] as string[])] : [];
      const at = list.indexOf(label);
      if (at >= 0) list.splice(at, 1);
      else list.push(label);
      return { ...cur, [text]: list };
    });
  };
  /** Option pick, or the typed free-form answer when one is present. */
  const valueFor = (text: string): string | string[] => {
    const typed = (other[text] ?? "").trim();
    return typed ? typed : picked[text] ?? "";
  };
  const complete = questions.every((q) => {
    const value = valueFor(q.question);
    return Array.isArray(value)
      ? value.length > 0
      : typeof value === "string" && value.length > 0;
  });
  const answer = () => {
    if (!key || !complete) return;
    const merged: Record<string, string | string[]> = {};
    for (const q of questions) merged[q.question] = valueFor(q.question);
    void respondToQuestion(key, message.seq, merged);
  };
  const skip = () => {
    if (key) void respondToQuestion(key, message.seq, null);
  };

  const btn =
    "inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-caption-1-medium transition-colors";

  return (
    <div className="flex w-full flex-col gap-2 text-left">
      <div className="flex items-center gap-1.5 text-caption-1-medium text-text-primary">
        <Check className="size-3.5 shrink-0 text-foreground-icon-secondary" aria-hidden />
        {t("chat.questionTitle")}
      </div>
      {status === "pending" && (
        <>
          {questions.map((q, qi) => {
            const value = picked[q.question];
            return (
              <div key={qi} className="flex flex-col gap-1.5">
                <div className="flex flex-col gap-0.5">
                  <span className="w-fit rounded-md bg-background-tertiary-default px-1.5 py-0.5 text-caption-1-regular text-text-secondary">
                    {q.header}
                  </span>
                  <span className="text-caption-1-regular text-text-primary">
                    {q.question}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {q.options.map((opt) => {
                    const selected = Array.isArray(value)
                      ? value.includes(opt.label)
                      : value === opt.label;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => pick(q.question, opt.label, Boolean(q.multiSelect))}
                        className={`flex min-w-0 max-w-full cursor-pointer flex-col items-start rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                          selected
                            ? "border-button-primary bg-background-tertiary-default"
                            : "border-border-secondary hover:bg-background-tertiary-hover"
                        }`}
                      >
                        <span className="text-caption-1-medium text-text-primary">
                          {opt.label}
                        </span>
                        {opt.description && (
                          <span className="text-caption-1-regular text-text-secondary">
                            {opt.description}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {q.multiSelect ? (
                  <div className="text-caption-1-regular text-text-tertiary">
                    {t("chat.questionMultiHint")}
                  </div>
                ) : (
                  <input
                    value={other[q.question] ?? ""}
                    onChange={(e) => {
                      setOther((cur) => ({ ...cur, [q.question]: e.target.value }));
                      // Typing a free-form answer supersedes any option pick.
                      setPicked((cur) => ({ ...cur, [q.question]: "" }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        answer();
                      }
                    }}
                    placeholder={t("chat.questionOtherPlaceholder")}
                    aria-label={t("chat.questionOther")}
                    className="rounded-md border border-border-secondary bg-background-tertiary-default px-2.5 py-1.5 text-caption-1-regular text-text-primary outline-none placeholder:text-text-tertiary"
                  />
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!complete}
              onClick={answer}
              className={`${btn} bg-button-primary text-text-white disabled:cursor-not-allowed disabled:text-button-primary-disabled-foreground`}
            >
              <Check className="size-3.5" aria-hidden />
              {t("chat.questionSubmit")}
            </button>
            <button
              type="button"
              onClick={skip}
              className={`${btn} bg-background-tertiary-default text-text-secondary hover:bg-background-tertiary-hover`}
            >
              <X className="size-3.5" aria-hidden />
              {t("chat.questionSkip")}
            </button>
          </div>
        </>
      )}
      {status === "answered" && (
        <div className="flex flex-col gap-0.5 text-caption-1-regular text-text-secondary">
          {questions.map((q, qi) => {
            const value = question.answers?.[q.question];
            const shown = Array.isArray(value) ? value.join(", ") : value ?? "";
            return (
              <div key={qi} className="break-words">
                {q.question} → {shown}
              </div>
            );
          })}
        </div>
      )}
      {status === "dismissed" && (
        <div className="text-caption-1-regular text-text-tertiary">
          {t("chat.questionSkipped")}
        </div>
      )}
      {status === "cancelled" && (
        <div className="text-caption-1-regular text-text-tertiary">
          {t("chat.questionCancelled")}
        </div>
      )}
    </div>
  );
}

/**
 * Timeline record for a question: the interaction itself lives in the dock
 * above the composer, so while pending this row is only a muted placeholder;
 * once settled it becomes the read-only history entry.
 */
export function QuestionRecord({ message }: { message: Message }) {
  const { t } = useTranslation();
  const question = message.question;
  if (!question) return null;
  const { status, questions } = question;
  return (
    <div className="flex max-w-[85%] flex-col gap-1 rounded-xl border border-border-secondary bg-background-secondary-default px-3.5 py-2.5 text-left">
      <div className="flex items-center gap-1.5 text-caption-1-medium text-text-secondary">
        <Check className="size-3.5 shrink-0 text-foreground-icon-secondary" aria-hidden />
        {t("chat.questionTitle")}
      </div>
      {status === "pending" && (
        <>
          <div className="text-caption-1-regular text-text-primary">
            {questions[0]?.question ?? ""}
          </div>
          <div className="text-caption-1-regular text-text-tertiary">
            {t("chat.questionWaiting")}
          </div>
        </>
      )}
      {status === "answered" && (
        <div className="flex flex-col gap-0.5 text-caption-1-regular text-text-secondary">
          {questions.map((q, qi) => {
            const value = question.answers?.[q.question];
            const shown = Array.isArray(value) ? value.join(", ") : value ?? "";
            return (
              <div key={qi} className="break-words">
                {q.question} → {shown}
              </div>
            );
          })}
        </div>
      )}
      {status === "dismissed" && (
        <div className="text-caption-1-regular text-text-tertiary">
          {t("chat.questionSkipped")}
        </div>
      )}
      {status === "cancelled" && (
        <div className="text-caption-1-regular text-text-tertiary">
          {t("chat.questionCancelled")}
        </div>
      )}
    </div>
  );
}
