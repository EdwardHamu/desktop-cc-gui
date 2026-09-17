import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Bot from "lucide-react/dist/esm/icons/bot";
import Copy from "lucide-react/dist/esm/icons/copy";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Eye from "lucide-react/dist/esm/icons/eye";
import {
  SettingsCard,
  SettingsSectionLabel,
} from "@/components/application/settings/settings-rows";
import { Button } from "@/components/base/buttons/button";
import { EmptyState } from "@/components/base/empty-state";
import { Input } from "@/components/base/input/input";
import { Switch } from "@/components/base/switch/switch";
import { ModalShell } from "@/components/dialogs";
import {
  currentCatalogLocale,
  useAgentStore,
} from "@/features/agents/agent-store";
import { errorText } from "@/lib/errors";
import {
  ipc,
  type BuiltInAgentCatalogView,
  type BuiltInAgentDivisionView,
  type BuiltInAgentPrompt,
  type BuiltInAgentView,
} from "@/lib/ipc";
import { openExternal } from "@/lib/platform";
import { cx } from "@/utils/cx";
import { ROW } from "../CliChannelRow";

/** Same affordance the agent rows use: bare icon, hover-revealed chrome. */
const ICON_BUTTON =
  "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-icon-secondary transition-colors hover:bg-background-secondary-hover hover:text-foreground-icon-primary";

/** Division filter chip (全部 + one per division). */
const chipClass = (active: boolean) =>
  cx(
    "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2 py-0.5 text-caption-1-regular transition-colors",
    active
      ? "border-border-button-active bg-background-tertiary-default text-text-primary"
      : "border-border-button-default text-text-secondary hover:bg-background-secondary-hover",
  );

/** Small division badge: color swatch from the catalog + localized label. */
function DivisionBadge({ division }: { division: BuiltInAgentDivisionView | undefined }) {
  if (!division) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border-button-default px-1.5 py-0.5 text-caption-1-regular text-text-tertiary">
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ backgroundColor: division.color }}
      />
      {division.label}
    </span>
  );
}

interface PromptViewState {
  agent: BuiltInAgentView;
  prompt: BuiltInAgentPrompt | null;
  error: string | null;
}

/**
 * Built-in agent catalog tab: summary (enabled count, source link,
 * revision), search / enabled-only / division filters, and card rows with
 * an enable switch, a prompt viewer, and copy-as-custom. The catalog is
 * read-only and bundled; enabled ids persist in app settings. Toggles
 * reload the catalog and revalidate useAgentStore so the composer `#`
 * menu picks up the change.
 */
export function BuiltInAgentsPane({ onCopied }: { onCopied: () => void }) {
  const { t, i18n } = useTranslation();
  const [catalog, setCatalog] = useState<BuiltInAgentCatalogView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [divisionId, setDivisionId] = useState<string | null>(null);

  /** Per-agent toggle in flight; the switch stays disabled meanwhile. */
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [divisionPending, setDivisionPending] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [promptView, setPromptView] = useState<PromptViewState | null>(null);

  const load = useCallback(async () => {
    try {
      setCatalog(await ipc.listBuiltInAgents(currentCatalogLocale()));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Catalog strings are localized: reload when the UI language changes.
  useEffect(() => {
    void load();
  }, [load, i18n.language]);

  const divisionById = useMemo(() => {
    const map = new Map<string, BuiltInAgentDivisionView>();
    for (const division of catalog?.divisions ?? []) {
      map.set(division.id, division);
    }
    return map;
  }, [catalog]);

  const enabledCount = useMemo(
    () => (catalog?.agents ?? []).filter((agent) => agent.enabled).length,
    [catalog],
  );

  const visibleAgents = useMemo(() => {
    if (!catalog) return [];
    const q = search.trim().toLowerCase();
    return catalog.agents.filter((agent) => {
      if (enabledOnly && !agent.enabled) return false;
      if (divisionId && agent.divisionId !== divisionId) return false;
      if (!q) return true;
      return (
        agent.name.toLowerCase().includes(q) ||
        agent.description.toLowerCase().includes(q) ||
        (divisionById.get(agent.divisionId)?.label.toLowerCase().includes(q) ?? false)
      );
    });
  }, [catalog, search, enabledOnly, divisionId, divisionById]);

  /** Every mutation funnel: apply, reload the catalog, and revalidate the
   *  composer-facing store. */
  const mutate = useCallback(
    async (op: () => Promise<unknown>) => {
      try {
        await op();
        await load();
        void useAgentStore.getState().refresh();
      } catch (e) {
        setError(errorText(e));
      }
    },
    [load],
  );

  const toggleAgent = useCallback(
    (agent: BuiltInAgentView, enabled: boolean) => {
      setPending((prev) => new Set(prev).add(agent.id));
      void mutate(() => ipc.setBuiltInAgentEnabled(agent.id, enabled)).finally(() =>
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(agent.id);
          return next;
        }),
      );
    },
    [mutate],
  );

  const toggleDivision = useCallback(
    (enabled: boolean) => {
      if (!divisionId) return;
      setDivisionPending(true);
      void mutate(() =>
        ipc.setBuiltInAgentDivisionEnabled(divisionId, enabled),
      ).finally(() => setDivisionPending(false));
    },
    [divisionId, mutate],
  );

  const viewPrompt = useCallback((agent: BuiltInAgentView) => {
    setPromptView({ agent, prompt: null, error: null });
    ipc
      .getBuiltInAgentPrompt(agent.id)
      .then((prompt) => setPromptView({ agent, prompt, error: null }))
      .catch((e: unknown) =>
        setPromptView({ agent, prompt: null, error: errorText(e) }),
      );
  }, []);

  const copyAsCustom = useCallback(
    (agent: BuiltInAgentView) => {
      setCopyingId(agent.id);
      ipc
        .getBuiltInAgentPrompt(agent.id)
        .then(({ prompt }) =>
          useAgentStore
            .getState()
            .create({ name: agent.name, icon: agent.icon ?? undefined, prompt }),
        )
        .then(() => {
          setPromptView(null);
          onCopied();
        })
        .catch((e: unknown) => setError(errorText(e)))
        .finally(() => setCopyingId(null));
    },
    [onCopied],
  );

  if (loading) {
    return (
      <p className="text-body-regular text-text-tertiary">{t("common.loading")}</p>
    );
  }
  if (!catalog) {
    return (
      <EmptyState className="flex-col gap-2 rounded-2xl border border-dashed border-border-button-default px-4 py-8">
        <p role="alert" className="text-body-regular text-text-error-primary">
          {t("settings.agentBuiltInLoadFailed")}
          {error ? `: ${error}` : ""}
        </p>
        <Button size="small" variant="secondary" onClick={() => void load()}>
          {t("settings.agentBuiltInRetry")}
        </Button>
      </EmptyState>
    );
  }

  const { provider } = catalog;

  return (
    <div className="flex w-full flex-col gap-2">
      {error && (
        <p role="alert" className="text-body-regular text-text-error-primary">
          {t("common.error")}: {error}
        </p>
      )}

      <SettingsSectionLabel>
        {t("settings.agentBuiltInSummary", {
          enabled: enabledCount,
          total: catalog.agents.length,
        })}
        <button
          type="button"
          onClick={() => openExternal(provider.sourceUrl)}
          className="ml-3 inline-flex cursor-pointer items-center gap-1 font-normal text-text-tertiary hover:text-text-secondary"
        >
          {provider.displayName}
          <ExternalLink aria-hidden className="size-3.5" />
        </button>
        <span className="ml-2 text-body-2-regular font-normal text-text-tertiary">
          @{provider.sourceRevision.slice(0, 8)} · {provider.license}
        </span>
      </SettingsSectionLabel>

      <div className="flex items-center gap-3">
        <Input
          value={search}
          onChange={setSearch}
          placeholder={t("settings.agentBuiltInSearchPlaceholder")}
          fieldClassName="w-56"
          aria-label={t("settings.agentBuiltInSearchPlaceholder")}
        />
        <div className="ml-auto flex items-center gap-2">
          <Switch
            size="sm"
            aria-label={t("settings.agentBuiltInEnabledOnly")}
            isSelected={enabledOnly}
            onChange={setEnabledOnly}
          />
          <span className="text-body-2-regular text-text-secondary">
            {t("settings.agentBuiltInEnabledOnly")}
          </span>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-1.5"
        aria-label={t("settings.agentBuiltInDivisions")}
      >
        <button
          type="button"
          className={chipClass(divisionId === null)}
          onClick={() => setDivisionId(null)}
        >
          {t("settings.agentBuiltInAll")}
          <span className="text-text-tertiary">
            {enabledCount}/{catalog.agents.length}
          </span>
        </button>
        {catalog.divisions.map((division) => (
          <button
            key={division.id}
            type="button"
            className={chipClass(divisionId === division.id)}
            onClick={() =>
              setDivisionId(divisionId === division.id ? null : division.id)
            }
          >
            <span
              aria-hidden
              className="size-1.5 rounded-full"
              style={{ backgroundColor: division.color }}
            />
            {division.label}
            <span className="text-text-tertiary">
              {division.enabledCount}/{division.count}
            </span>
          </button>
        ))}
        {divisionId && (
          <span className="ml-auto flex items-center gap-1">
            <Button
              size="small"
              variant="secondary"
              disabled={divisionPending}
              onClick={() => toggleDivision(true)}
            >
              {t("settings.agentBuiltInEnableDivision")}
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabled={divisionPending}
              onClick={() => toggleDivision(false)}
            >
              {t("settings.agentBuiltInDisableDivision")}
            </Button>
          </span>
        )}
      </div>

      {visibleAgents.length === 0 ? (
        <EmptyState className="flex-col gap-1 rounded-2xl border border-dashed border-border-button-default px-4 py-8">
          <p className="text-body-2-regular text-text-secondary">
            {t("settings.agentBuiltInEmpty")}
          </p>
        </EmptyState>
      ) : (
        <SettingsCard>
          {visibleAgents.map((agent) => (
            <div key={agent.id} className={ROW}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-2lg bg-background-tertiary-default text-foreground-icon-primary">
                {agent.icon ? (
                  <span className="text-base leading-none" aria-hidden>
                    {agent.icon}
                  </span>
                ) : (
                  <Bot className="size-4" aria-hidden />
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="flex items-center gap-2 text-body-regular text-text-primary">
                  <span className="truncate">{agent.name}</span>
                  <DivisionBadge division={divisionById.get(agent.divisionId)} />
                </p>
                {agent.description && (
                  <p
                    className="truncate text-body-2-regular text-text-secondary"
                    title={agent.description}
                  >
                    {agent.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label={t("settings.agentBuiltInViewPrompt")}
                title={t("settings.agentBuiltInViewPrompt")}
                onClick={() => viewPrompt(agent)}
                className={ICON_BUTTON}
              >
                <Eye className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={t("settings.agentBuiltInCopy")}
                title={t("settings.agentBuiltInCopy")}
                disabled={copyingId === agent.id}
                onClick={() => copyAsCustom(agent)}
                className={cx(ICON_BUTTON, "disabled:cursor-default disabled:opacity-50")}
              >
                <Copy className="size-4" aria-hidden />
              </button>
              <Switch
                size="sm"
                aria-label={t("settings.agentBuiltInToggle", { name: agent.name })}
                isSelected={agent.enabled}
                isDisabled={pending.has(agent.id)}
                onChange={(enabled) => toggleAgent(agent, enabled)}
              />
            </div>
          ))}
        </SettingsCard>
      )}

      {promptView && (
        <ModalShell
          onClose={() => setPromptView(null)}
          label={promptView.agent.name}
          className="flex max-h-[calc(100dvh-64px)] w-[560px] max-w-[calc(100vw-32px)] flex-col"
        >
          <p className="flex items-center gap-2 text-title-3-medium text-text-primary">
            {promptView.agent.icon && (
              <span aria-hidden>{promptView.agent.icon}</span>
            )}
            {promptView.agent.name}
          </p>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-2lg bg-background-tertiary-default p-3">
            {promptView.error ? (
              <p role="alert" className="text-body-regular text-text-error-primary">
                {promptView.error}
              </p>
            ) : promptView.prompt ? (
              <pre className="whitespace-pre-wrap font-mono text-body-2-regular text-text-secondary">
                {promptView.prompt.prompt}
              </pre>
            ) : (
              <p className="text-body-regular text-text-tertiary">
                {t("settings.agentBuiltInPromptLoading")}
              </p>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              size="small"
              leadingIcon={Copy}
              disabled={!promptView.prompt || copyingId === promptView.agent.id}
              onClick={() => copyAsCustom(promptView.agent)}
            >
              {t("settings.agentBuiltInCopy")}
            </Button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
