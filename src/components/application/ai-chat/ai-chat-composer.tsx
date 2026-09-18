"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import GitMerge from "lucide-react/dist/esm/icons/git-merge";
import Globe from "lucide-react/dist/esm/icons/globe";
import Bot from "lucide-react/dist/esm/icons/bot";
import {
  Button as AriaButton,
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  Popover as AriaPopover,
} from "react-aria-components";
import {
  AgentLimitsCard,
  type ContextSegment,
  type UsageLimit,
} from "@/components/application/agent-limits/agent-limits-card";
import { Tooltip, TooltipContent } from "@/components/base/tooltip/tooltip";
import { ProjectFolderMenu } from "@/components/application/ai-chat/project-folder-menu";
import {
  BranchMenu,
  type BranchMenuItem,
} from "@/components/application/ai-chat/branch-menu";
import { ComposerResizeHandle } from "@/components/application/ai-chat/composer-resize-handle";
import { ComposerEditable } from "@/components/application/ai-chat/composer-editable";
import { ComposerToolbar } from "@/components/application/ai-chat/composer-toolbar";
import { useMentionPicker } from "@/components/application/ai-chat/use-mention-picker";
import { useSlashPicker } from "@/components/application/ai-chat/use-slash-picker";
import { useAgentPicker } from "@/components/application/ai-chat/use-agent-picker";
import { usePromptPicker } from "@/components/application/ai-chat/use-prompt-picker";
import { useResizableComposer } from "@/components/application/ai-chat/use-resizable-composer";
import {
  FILE_TAG_CLASS,
  extractText,
  findMentionTrigger,
  getCaretOffset,
  htmlFromText,
  insertTextAtCaret,
  mentionToken,
  renderFileTags,
  sanitizeEditableHtml,
  setCaretOffset,
} from "@/components/application/ai-chat/file-tags";
import { FileMentionMenu } from "@/components/application/ai-chat/file-mention-menu";
import { SlashCommandMenu } from "@/components/application/ai-chat/slash-command-menu";
import { findSlashTrigger } from "@/components/application/ai-chat/slash-commands";
import {
  AgentMenu,
  CREATE_NEW_AGENT_ID,
} from "@/components/application/ai-chat/agent-menu";
import {
  PromptMenu,
  CREATE_NEW_PROMPT_PATH,
} from "@/components/application/ai-chat/prompt-menu";
import {
  findBangTrigger,
  findHashTrigger,
} from "@/components/application/ai-chat/agent-prompt-triggers";
import { type MentionEntry } from "@/components/application/ai-chat/mention-files";
import { ipc, type AgentConfig, type CustomPromptEntry, type SlashCommandEntry } from "@/lib/ipc";
import { useSelectedAgent } from "@/features/agents/selected-agent";
import { useChatStore } from "@/features/chat/store";
import { listenSettingsChanged } from "@/lib/events";
import { useTauriEvent } from "@/hooks/use-tauri-event";
import { joinPath } from "@/features/files/store";
import { ASSUMED_CONTEXT_WINDOW } from "@/features/chat/usage";
import {
  usePromptCompletion,
  usePromptHistoryNav,
} from "@/components/application/ai-chat/use-prompt-history";
import { cx } from "@/utils/cx";
import { useDismissOnOutsidePress, useTriggerToggle } from "@/utils/use-dismiss-on-outside-press";
import {
  compareByOrder,
  composerStatusRegistry,
  pluginIdFromRegistryKey,
  useRegistry,
} from "@ccgui/plugin-sdk";
import { PluginBoundary } from "@/features/plugins/boundary/PluginBoundary";

/**
 * Board UI → "ai_chat" composer + status bar, adapted to live data. The pill
 * keeps the template visual (add menu, model menu, send control); the field
 * is a textarea so Shift+Enter inserts a newline; while a turn streams the
 * send button becomes a stop control. The status bar renders real branch /
 * workspace / token usage.
 */

/** Imperative handle on the composer's editable field. */
export interface ComposerInputHandle {
  focus: () => void;
  /** Insert plain text at the caret; `@/abs/path` mentions render as chips. */
  insertText: (text: string) => void;
  /** Focus the field and open the `/` picker, appending a line-start `/`
   *  when the caret is not already inside a slash trigger. */
  openSlashPicker: () => void;
}

export interface ComposerProps {
  className?: string;
  /** Controlled field value. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Fires on the send button and on the configured send gesture (sendShortcut). */
  onSubmit?: (value: string) => void;
  /** Send gesture: "enter" = Enter sends, Shift+Enter newline (default);
   *  "cmdEnter" = ⌘/Ctrl+Enter sends, plain Enter newline. */
  sendShortcut?: "enter" | "cmdEnter";
  /** Fires on the stop button while streaming. */
  onStop?: () => void;
  /** A turn is in flight: send becomes stop. */
  streaming?: boolean;
  /** Greys out send. */
  disabled?: boolean;
  /** Slot for the add-attachment menu (template AddMenu). */
  addMenu?: ReactNode;
  /** Slot for the CLI + model switcher (CliMenu). */
  cliMenu?: ReactNode;
  /** Slot for the permission-mode picker (PermissionMenu). */
  permissionMenu?: ReactNode;
  /** The field itself, for focus management and mention insertion. */
  inputRef?: MutableRefObject<ComposerInputHandle | null>;
  /** Clipboard images pasted into the field; absent = paste stays text-only. */
  onPasteImages?: (files: File[]) => void;
  /** Active workspace root: enables the `@` file-mention picker. */
  workspacePath?: string;
}

export function Composer({
  className,
  value,
  onValueChange,
  onSubmit,
  sendShortcut = "enter",
  onStop,
  streaming = false,
  disabled = false,
  addMenu,
  cliMenu,
  permissionMenu,
  inputRef,
  onPasteImages,
  workspacePath,
}: ComposerProps = {}) {
  const editableRef = useRef<HTMLDivElement>(null);
  // IME composition tracking (desktop-cc-gui parity): WKWebView fires
  // `compositionend` BEFORE the Enter keydown that commits the candidate, so
  // `nativeEvent.isComposing` is already false at that keydown and the plain
  // check would send the message. Gate Enter on a sync ref plus a 100ms
  // "recently settled" window after compositionend.
  const isComposingRef = useRef(false);
  const lastCompositionEndTimeRef = useRef(0);
  // Reactive mirror of isComposingRef: gates the ghost completion so IME
  // candidates never produce a suggestion.
  const [isComposing, setIsComposing] = useState(false);

  // Top-edge drag resize (desktop-cc-gui parity): the handle fixes the field
  // at an explicit height; without a manual size the field keeps auto-growing.
  const { isResizing, isCollapsed, manualHeightPx, getHandleProps, nudge } =
    useResizableComposer({ editableRef });

  /** Last text we emitted upward; the value-sync effect skips our own echoes. */
  const lastEmittedRef = useRef("");

  // @-mention file picker: trigger tracking, caret anchoring, and workspace
  // lifecycle live in useMentionPicker; the menu + select action stay wired
  // here. The parent owns the wrapper ref (root div + popover anchor).
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { mention, setMention, mentionMenuRef, updateMentionTrigger } =
    useMentionPicker({ editableRef, wrapperRef, workspacePath, value, lastEmittedRef });
  // `/` command picker: same trigger-tracking model as the mention picker.
  const { slash, setSlash, slashMenuRef, updateSlashTrigger } =
    useSlashPicker({ editableRef, wrapperRef, workspacePath, value, lastEmittedRef });

  // `#` agent picker and `!` prompt picker: same trigger-tracking model.
  const { agent, setAgent, agentMenuRef, updateAgentTrigger } =
    useAgentPicker({ editableRef, wrapperRef, workspacePath, value, lastEmittedRef });
  const { prompt, setPrompt, promptMenuRef, updatePromptTrigger } =
    usePromptPicker({ editableRef, wrapperRef, workspacePath, value, lastEmittedRef });

  const { t } = useTranslation();
  const navigate = useNavigate();
  // The pinned agent is keyed per thread; draft tabs share a slot until the
  // engine stamps a native session id (see selected-agent.ts).
  const activeSessionId = useChatStore((s) => s.active?.sessionId ?? null);
  const {
    agent: selectedAgent,
    select: selectAgent,
    clear: clearSelectedAgent,
  } = useSelectedAgent(workspacePath ?? "", activeSessionId);

  // One detection pass per input, priority `/` > `@` > `#` > `!`
  // (desktop-cc-gui parity: a line-start slash owns the completion surface;
  // `@` inside a slash query must not open the file picker on top of it;
  // only one picker is active at a time).
  const updateTriggers = useCallback(() => {
    if (updateSlashTrigger()) {
      setMention(null);
      setAgent(null);
      setPrompt(null);
      return;
    }
    // `@` outranks `#`/`!`; the mention hook's update returns void, so
    // pre-check with the same finder its picker uses.
    const el = editableRef.current;
    const caret = el ? getCaretOffset(el) : -1;
    if (
      el &&
      workspacePath &&
      caret >= 0 &&
      findMentionTrigger(extractText(el), caret)
    ) {
      updateMentionTrigger();
      setAgent(null);
      setPrompt(null);
      return;
    }
    setMention(null);
    if (updateAgentTrigger()) {
      setPrompt(null);
      return;
    }
    updatePromptTrigger();
  }, [
    updateSlashTrigger,
    updateMentionTrigger,
    updateAgentTrigger,
    updatePromptTrigger,
    setMention,
    setAgent,
    setPrompt,
    workspacePath,
  ]);

  const emitChange = useCallback(() => {
    const el = editableRef.current;
    if (!el) return;
    // Keep the DOM truly empty when the text is, so the :empty placeholder
    // shows (browsers like to leave a stray <br> behind).
    const text = extractText(el);
    if (text === "" && el.innerHTML !== "") el.innerHTML = "";
    lastEmittedRef.current = text;
    onValueChange?.(text);
  }, [onValueChange]);

  const syncTags = useCallback(() => {
    const el = editableRef.current;
    if (el && !isComposingRef.current) renderFileTags(el);
  }, []);

  /** Replace the active `@query` trigger with the picked file's mention
   *  token (+ trailing space) and render it as a chip. */
  const handleMentionSelect = useCallback(
    (entry: MentionEntry) => {
      const el = editableRef.current;
      if (!el || !workspacePath) return;
      setMention(null);
      const token = mentionToken(joinPath(workspacePath, entry.rel)) + " ";
      const caret = getCaretOffset(el);
      const text = extractText(el);
      // Recompute the trigger at select time — the caret may have moved
      // since the menu last sampled it.
      const trigger = caret >= 0 ? findMentionTrigger(text, caret) : null;
      el.focus();
      if (!trigger) {
        insertTextAtCaret(el, token);
      } else {
        const next =
          text.slice(0, trigger.start) +
          token +
          text.slice(trigger.start + 1 + trigger.query.length);
        el.innerHTML = sanitizeEditableHtml(htmlFromText(next));
        setCaretOffset(el, trigger.start + token.length);
      }
      emitChange();
      syncTags();
    },
    [workspacePath, emitChange, syncTags, setMention],
  );
  /** Replace the active `/query` trigger with the picked command
   *  (+ trailing space). Plain text, no chip: the CLI expands `/name args`
   *  itself when the prompt is sent. */
  const handleSlashSelect = useCallback(
    (entry: SlashCommandEntry) => {
      const el = editableRef.current;
      if (!el) return;
      setSlash(null);
      const token = `/${entry.name} `;
      const caret = getCaretOffset(el);
      const text = extractText(el);
      // Recompute the trigger at select time — the caret may have moved
      // since the menu last sampled it.
      const trigger = caret >= 0 ? findSlashTrigger(text, caret) : null;
      el.focus();
      if (!trigger) {
        insertTextAtCaret(el, token);
      } else {
        const next =
          text.slice(0, trigger.start) +
          token +
          text.slice(trigger.start + 1 + trigger.query.length);
        el.innerHTML = sanitizeEditableHtml(htmlFromText(next));
        setCaretOffset(el, trigger.start + token.length);
      }
      emitChange();
      syncTags();
    },
    [emitChange, syncTags, setSlash],
  );
  /** Pin the picked agent to this thread and strip the `#query` trigger
   *  from the field (the agent rides the message as a role block on send,
   *  not as text). The create row jumps to the settings page instead. */
  const handleAgentSelect = useCallback(
    (entry: AgentConfig) => {
      setAgent(null);
      if (entry.id === CREATE_NEW_AGENT_ID) {
        navigate("/settings?page=agentsPrompts");
        return;
      }
      const el = editableRef.current;
      if (!el) return;
      selectAgent(entry);
      const caret = getCaretOffset(el);
      const text = extractText(el);
      // Recompute the trigger at select time — the caret may have moved
      // since the menu last sampled it.
      const trigger = caret >= 0 ? findHashTrigger(text, caret) : null;
      el.focus();
      if (trigger) {
        const next =
          text.slice(0, trigger.start) +
          text.slice(trigger.start + 1 + trigger.query.length);
        el.innerHTML = sanitizeEditableHtml(htmlFromText(next));
        setCaretOffset(el, trigger.start);
      }
      emitChange();
      syncTags();
    },
    [emitChange, syncTags, setAgent, selectAgent, navigate],
  );
  /** Replace the active `!query` trigger with the picked prompt's content,
   *  caret to the end of the inserted text. The create row jumps to the
   *  settings page instead. */
  const handlePromptSelect = useCallback(
    (entry: CustomPromptEntry) => {
      setPrompt(null);
      if (entry.path === CREATE_NEW_PROMPT_PATH) {
        navigate("/settings?page=agentsPrompts");
        return;
      }
      const el = editableRef.current;
      if (!el) return;
      const caret = getCaretOffset(el);
      const text = extractText(el);
      // Recompute the trigger at select time — the caret may have moved
      // since the menu last sampled it.
      const trigger = caret >= 0 ? findBangTrigger(text, caret) : null;
      el.focus();
      if (!trigger) {
        insertTextAtCaret(el, entry.content);
      } else {
        const next =
          text.slice(0, trigger.start) +
          entry.content +
          text.slice(trigger.start + 1 + trigger.query.length);
        el.innerHTML = sanitizeEditableHtml(htmlFromText(next));
        setCaretOffset(el, trigger.start + entry.content.length);
      }
      emitChange();
      syncTags();
    },
    [emitChange, syncTags, setPrompt, navigate],
  );
  // Ghost-text completion from prompt history (desktop-cc-gui parity):
  // suffix is painted via data-completion-suffix and accepted with Tab.
  const completion = usePromptCompletion(isComposing ? "" : (value ?? ""));

  // Replace the field's content programmatically (history recall, Tab
  // accept): rebuild DOM from text, caret to end, emit upward.
  const setEditableText = useCallback(
    (text: string) => {
      const el = editableRef.current;
      if (!el) return;
      el.innerHTML = sanitizeEditableHtml(htmlFromText(text));
      setCaretOffset(el, text.length);
      emitChange();
      syncTags();
    },
    [emitChange, syncTags],
  );

  // ArrowUp/ArrowDown recall of previously submitted prompts.
  const { handleKeyDown: handleHistoryKeyDown } = usePromptHistoryNav({
    editableRef,
    setText: setEditableText,
  });

  // External value changes (draft restore on tab switch, clear on submit):
  // the effect below rebuilds the DOM from text; the mention picker resets
  // itself on the same signal (see useMentionPicker). Own emissions are
  // already in the DOM and skip both paths through lastEmittedRef.
  useEffect(() => {
    const v = value ?? "";
    if (v === lastEmittedRef.current) return;
    lastEmittedRef.current = v;
    const el = editableRef.current;
    if (el) el.innerHTML = sanitizeEditableHtml(htmlFromText(v));
  }, [value]);

  // Expose the field handle (focus + mention insertion from the file tree).
  useEffect(() => {
    if (!inputRef) return;
    const handle: ComposerInputHandle = {
      focus: () => editableRef.current?.focus(),
      insertText: (text) => {
        const el = editableRef.current;
        if (!el) return;
        insertTextAtCaret(el, text);
        emitChange();
        syncTags();
      },
      openSlashPicker: () => {
        const el = editableRef.current;
        if (!el) return;
        el.focus();
        // Append at the end: the trigger regex only accepts a line-start
        // `/`, so an arbitrary caret position mid-line could not open the
        // picker anyway.
        const text = extractText(el);
        setCaretOffset(el, text.length);
        if (!findSlashTrigger(text, text.length)) {
          insertTextAtCaret(el, text === "" || text.endsWith("\n") ? "/" : "\n/");
        }
        emitChange();
        syncTags();
        updateSlashTrigger();
        // react-aria restores focus to the popover trigger when the add
        // menu unmounts — after our focus() above. Reclaim the field so
        // typing reaches it once the picker is open.
        requestAnimationFrame(() => editableRef.current?.focus());
      },
    };
    inputRef.current = handle;
    return () => {
      if (inputRef.current === handle) inputRef.current = null;
    };
  }, [inputRef, emitChange, syncTags, updateSlashTrigger]);

  // Chip × removal via delegation (chips are raw DOM, not React).
  useEffect(() => {
    const el = editableRef.current;
    if (!el) return;
    const onClick = (event: MouseEvent) => {
      const close = (event.target as HTMLElement).closest?.(`.${FILE_TAG_CLASS}-close`);
      if (!close) return;
      event.preventDefault();
      event.stopPropagation();
      close.closest(`.${FILE_TAG_CLASS}`)?.remove();
      emitChange();
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [emitChange]);

  return (
    <div
      ref={wrapperRef}
      className={cx(
        "relative flex w-full flex-col gap-1 rounded-2xl border p-2 shadow-xs",
        isCollapsed
          ? "h-2 gap-0 border-transparent bg-transparent p-0 shadow-none"
          : "border-separator-border bg-background-primary-default",
        className,
      )}
    >
      <ComposerResizeHandle
        getHandleProps={getHandleProps}
        nudge={nudge}
        isResizing={isResizing}
        isCollapsed={isCollapsed}
      />
      {/* TEMP DEBUG: remove after # / ! picker diagnosis */}
      <DebugProbe
        probe={{
          ws: workspacePath ?? null,
          agent,
          prompt,
          slash: slash?.query ?? null,
          text: value ?? "",
        }}
      />
      {!isCollapsed && mention && workspacePath && (
        <FileMentionMenu
          root={workspacePath}
          query={mention.query}
          left={mention.left}
          onSelect={handleMentionSelect}
          onClose={() => setMention(null)}
          menuRef={mentionMenuRef}
        />
      )}
      {!isCollapsed && slash && workspacePath && (
        <SlashCommandMenu
          root={workspacePath}
          query={slash.query}
          left={slash.left}
          onSelect={handleSlashSelect}
          onClose={() => setSlash(null)}
          menuRef={slashMenuRef}
        />
      )}
      {!isCollapsed && agent && workspacePath && (
        <AgentMenu
          query={agent.query}
          left={agent.left}
          onSelect={handleAgentSelect}
          onClose={() => setAgent(null)}
          menuRef={agentMenuRef}
        />
      )}
      {!isCollapsed && prompt && workspacePath && (
        <PromptMenu
          root={workspacePath}
          query={prompt.query}
          left={prompt.left}
          onSelect={handlePromptSelect}
          onClose={() => setPrompt(null)}
          menuRef={promptMenuRef}
        />
      )}

      {/* Pinned-agent chip above the input, styled after the attachment
          chips (ConversationFooter); × clears the selection. */}
      {!isCollapsed && selectedAgent && (
        <div className="flex flex-wrap gap-1.5 px-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-background-tertiary-default py-0.5 pl-2 text-caption-1-medium text-text-secondary">
            {selectedAgent.icon ? (
              <span aria-hidden>{selectedAgent.icon}</span>
            ) : (
              <Bot
                aria-hidden
                className="size-3.5 shrink-0 text-foreground-icon-secondary"
              />
            )}
            <span className="max-w-48 truncate">{selectedAgent.name}</span>
            <button
              type="button"
              aria-label={t("chat.selectedAgentRemove")}
              onClick={clearSelectedAgent}
              className="cursor-pointer rounded-full px-1 hover:text-text-primary"
            >
              ×
            </button>
          </span>
        </div>
      )}

      {!isCollapsed && (
        <ComposerEditable
          editableRef={editableRef}
          sendShortcut={sendShortcut}
          mentionOpen={mention != null}
          slashOpen={slash != null}
          agentOpen={agent != null}
          promptOpen={prompt != null}
          completionSuffix={completion.suffix}
          acceptCompletion={completion.accept}
          setEditableText={setEditableText}
          handleHistoryKeyDown={handleHistoryKeyDown}
          mentionMenuRef={mentionMenuRef}
          slashMenuRef={slashMenuRef}
          agentMenuRef={agentMenuRef}
          promptMenuRef={promptMenuRef}
          isComposingRef={isComposingRef}
          lastCompositionEndTimeRef={lastCompositionEndTimeRef}
          setIsComposing={setIsComposing}
          emitChange={emitChange}
          syncTags={syncTags}
          updateTriggers={updateTriggers}
          disabled={disabled}
          onSubmit={onSubmit}
          onPasteImages={onPasteImages}
          manualHeightPx={manualHeightPx}
        />
      )}

      {!isCollapsed && (
        <ComposerToolbar
          addMenu={addMenu}
          cliMenu={cliMenu}
          permissionMenu={permissionMenu}
          streaming={streaming}
          disabled={disabled}
          onStop={onStop}
          onSend={() => onSubmit?.(value ?? "")}
        />
      )}
    </div>
  );
}

/** TEMP DEBUG: beacon composer trigger state to the vite dev server
 *  (CPS-safe same-origin fetch). Remove after diagnosis. */
function DebugProbe({ probe }: { probe: Record<string, unknown> }) {
  const json = JSON.stringify(probe);
  useEffect(() => {
    fetch("/__dbg?" + encodeURIComponent(json)).catch(() => {});
  }, [json]);
  return null;
}

/* -------------------------------------------------------------- status bar */
const CONTEXT_POPOVER_CLASSES = cx(
  "w-[340px] max-w-[calc(100vw-32px)] origin-bottom-right",
  "rounded-2xl border border-border-button-default bg-background-primary-default p-2 shadow-dropdown",
  "transition duration-150 ease-out",
  "data-[entering]:opacity-0 data-[entering]:scale-95 data-[entering]:blur-[2px]",
  "data-[exiting]:opacity-0 data-[exiting]:scale-95 data-[exiting]:blur-[2px]",
);

const EMPTY_LIMITS: UsageLimit[] = [];
const EMPTY_PLAN = "";

/**
 * Mirrors `validate_proxy_settings` in src-tauri/src/proxy.rs: enabling the
 * proxy requires a configured URL with an http(s)/socks5 scheme and a host.
 * Disabling never fails validation, so an enabled toggle stays operable even
 * if the stored URL is later broken.
 */
function isUsableProxyUrl(value: string | null): boolean {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  const scheme = parsed.protocol.replace(":", "");
  return (
    ["http", "https", "socks5", "socks5h"].includes(scheme) &&
    parsed.hostname.length > 0
  );
}

/**
 * One-click network-proxy switch for the composer footer: the glyph carries
 * the state (dim = off, green = on) and the click persists `systemProxyEnabled`
 * through the same read-modify-write funnel the settings page uses, so the two
 * surfaces can never clobber each other.
 *
 * Hidden entirely while off without a usable proxy URL — enabling would fail
 * backend validation anyway, so the entry only appears once the settings page
 * has a valid URL to flip on.
 */
function ProxyQuickToggle() {
  const { t } = useTranslation();
  const [state, setState] = useState<{ enabled: boolean; url: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const read = useCallback(() => {
    void ipc
      .getAppSettings()
      .then((s) =>
        setState({ enabled: s.systemProxyEnabled ?? false, url: s.systemProxyUrl ?? null }),
      )
      .catch(() => {});
  }, []);

  useEffect(() => read(), [read]);
  // The settings page (desktop or phone) writes the same field.
  useTauriEvent(() => listenSettingsChanged(read));

  const toggle = useCallback(async () => {
    if (busy || !state) return;
    setBusy(true);
    try {
      const latest = await ipc.getAppSettings();
      const next = !(latest.systemProxyEnabled ?? false);
      await ipc.updateAppSettings({ ...latest, systemProxyEnabled: next });
      setState({ enabled: next, url: latest.systemProxyUrl ?? null });
    } catch {
      // Persist failed: keep the old glyph, the settings page is where the
      // reason is shown.
    } finally {
      setBusy(false);
    }
  }, [busy, state]);

  if (!state) return null;
  const { enabled } = state;
  // Off + no valid URL → enabling is impossible; hide the entry. On → always
  // shown, disabling never fails validation.
  if (!enabled && !isUsableProxyUrl(state.url)) return null;
  const label = enabled ? t("chat.proxyOn") : t("chat.proxyOff");
  const tip = enabled ? t("chat.proxyTipOn") : t("chat.proxyTipOff");
  // Mirror the context-meter button exactly: react-aria AriaButton, the same
  // shape/focus classes, colour carries the state. That control never shows
  // a stray circle, so this one should not either.
  return (
    <Tooltip>
      <AriaButton
        aria-label={label}
        aria-pressed={enabled}
        isDisabled={busy}
        onPress={() => void toggle()}
        className={cx(
          "flex cursor-pointer items-center rounded-full p-1.5 outline-none transition-colors duration-150 ease focus-visible:ring-2 focus-visible:ring-border-focus-ring",
          enabled ? "text-notification-success-foreground" : "text-foreground-icon-tertiary",
        )}
      >
        <Globe className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      </AriaButton>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

/** 16px circular context meter at `pct` percent. */
function ContextRing({ pct }: { pct: number }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" className="shrink-0 -rotate-90">
      <circle cx="8" cy="8" r={r} fill="none" stroke="var(--color-agent-progress-ring)" strokeWidth="2.5" />
      <circle
        cx="8"
        cy="8"
        r={r}
        fill="none"
        stroke="var(--color-foreground-icon-tertiary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
      />
    </svg>
  );
}

export function StatusBar({
  branch,
  branches,
  branchRepoName,
  onBranchSelect,
  folders,
  selectedFolder,
  onFolderSelect,
  usagePct,
  contextMax,
  contextSegments,
  onCompactContext,
  onRefreshUsage,
  compacting,
  refreshing,
  canCompact,
}: {
  branch?: string;
  /** Local branches for the switcher; empty until the first load. */
  branches?: BranchMenuItem[];
  /** Repository display name when the chip tracks a nested repo (file-tree
   *  selection inside a subfolder repository); prefixes the branch label. */
  branchRepoName?: string;
  /** Present → the branch label becomes a switcher dropdown. */
  onBranchSelect?: (name: string) => void;
  /** Workspace folder display names. */
  folders?: string[];
  selectedFolder?: string;
  onFolderSelect?: (name: string) => void;
  usagePct?: number;
  /** Context window size in tokens for the breakdown card. */
  contextMax?: number;
  /** Token buckets for the breakdown card; empty until usage is reported. */
  contextSegments?: ContextSegment[];
  onCompactContext?: () => void;
  onRefreshUsage?: () => void;
  compacting?: boolean;
  refreshing?: boolean;
  canCompact?: boolean;
}) {
  const { t } = useTranslation();
  // `isNonModal` popovers don't dismiss on outside press (react-aria couples
  // the two); restore it manually — same fix as Select (see the hook doc).
  const [contextOpen, setContextOpen] = useState(false);
  const contextTriggerRef = useRef<HTMLButtonElement>(null);
  const contextPopoverRef = useRef<HTMLElement>(null);
  useDismissOnOutsidePress(contextOpen, () => setContextOpen(false), [
    contextTriggerRef,
    contextPopoverRef,
  ]);
  const allowContextOpenChange = useTriggerToggle(contextOpen, contextTriggerRef);
  // Plugin chips (SDK 0.3.9, permission ui:composer-status) render in the
  // left group after the branch switcher, each behind its own boundary.
  const pluginItems = useRegistry(composerStatusRegistry);
  const limitsContext = useMemo(
    () => ({ max: contextMax ?? ASSUMED_CONTEXT_WINDOW, segments: contextSegments ?? [] }),
    [contextMax, contextSegments],
  );
  const limitsText = useMemo(
    () => ({
      contextWindow: t("chat.contextWindow"),
      freeSpace: t("chat.freeSpace"),
      planUsageLimits: t("chat.planUsageLimits"),
      managePlan: t("chat.managePlan"),
      compactContext: t("chat.compactContext"),
      compactContextTooltip: t("chat.compactContextTooltip"),
      compacting: t("chat.compacting"),
      refreshUsage: t("chat.refreshUsage"),
      refreshUsageTooltip: t("chat.refreshUsageTooltip"),
      refreshing: t("chat.refreshing"),
    }),
    [t],
  );
  return (
    <div className="flex h-[26px] w-full items-center justify-between select-none">
      <div className="flex items-center gap-3">
        {folders && folders.length > 0 && (
          <ProjectFolderMenu
            folders={folders}
            selectedName={selectedFolder}
            onSelect={onFolderSelect}
          />
        )}
        {branch &&
          (onBranchSelect ? (
            <BranchMenu
              branches={branches ?? []}
              currentName={branch}
              repoName={branchRepoName}
              onSelect={onBranchSelect}
            />
          ) : (
            <span className="flex items-center gap-1">
              <GitMerge
                className="size-3.5 shrink-0 -scale-y-100 text-foreground-icon-tertiary"
                aria-hidden
              />
              <span className="text-caption-1-regular whitespace-nowrap text-text-tertiary">
                {branch}
              </span>
            </span>
          ))}
        {[...pluginItems].sort(compareByOrder).map((def) => {
          const pluginId = pluginIdFromRegistryKey(def.id);
          const Chip = def.component;
          return (
            <PluginBoundary key={def.id} pluginId={pluginId}>
              <Chip />
            </PluginBoundary>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <ProxyQuickToggle />
        {/* Context meter is always on: 0% until the first usage report. */}
        <AriaDialogTrigger
          isOpen={contextOpen}
          onOpenChange={(o) => allowContextOpenChange(o) && setContextOpen(o)}
        >
          <AriaButton
            ref={contextTriggerRef}
            aria-label={t("chat.contextWindow")}
            className="flex cursor-pointer items-center gap-1 rounded-[40px] py-1 pr-2 pl-1.5 outline-none transition-colors duration-150 ease focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <ContextRing pct={usagePct ?? 0} />
            <span className="text-body-2-medium whitespace-nowrap text-text-secondary">
              {usagePct ?? 0}%
            </span>
          </AriaButton>
          <AriaPopover
            ref={contextPopoverRef}
            isNonModal
            placement="top end"
            offset={8}
            className={CONTEXT_POPOVER_CLASSES}
          >
            <AriaDialog aria-label={t("chat.contextWindow")} className="outline-none">
              <AgentLimitsCard
                context={limitsContext}
                plan={EMPTY_PLAN}
                limits={EMPTY_LIMITS}
                text={limitsText}
                onCompact={onCompactContext}
                onRefresh={onRefreshUsage}
                compacting={compacting}
                refreshing={refreshing}
                canCompact={canCompact}
              />
            </AriaDialog>
          </AriaPopover>
        </AriaDialogTrigger>
      </div>
    </div>
  );
}
