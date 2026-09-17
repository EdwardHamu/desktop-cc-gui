import Minus from "lucide-react/dist/esm/icons/minus";
import Square from "lucide-react/dist/esm/icons/square";
import Copy from "lucide-react/dist/esm/icons/copy";
import X from "lucide-react/dist/esm/icons/x";
import { useTranslation } from "react-i18next";
import { isWeb } from "@/lib/transport";
import { requestAppClose } from "@/lib/close-confirm";
import { useWindowChrome } from "./use-window-chrome";

/** The browser already supplies its own chrome; never expose inert buttons. */
export function WindowTitleBar() {
  return isWeb ? null : <DesktopTitleBar />;
}

function DesktopTitleBar() {
  const { t } = useTranslation();
  const { maximized, failed, busy, run } = useWindowChrome();
  const maximizeLabel = t(maximized ? "windowTitleBar.restore" : "windowTitleBar.maximize");
  const buttonClass = "flex h-8 w-11 shrink-0 items-center justify-center border-0 bg-transparent text-text-secondary transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white disabled:opacity-50";

  return (
    <header
      aria-label={t("windowTitleBar.label")}
      className="chat-glass-surface relative z-[60] flex h-8 shrink-0 items-center border-b border-separator-border select-none"
    >
      {/* One drag handler, not data-tauri-drag-region plus a second handler.
          Buttons are siblings, so their pointer events never start dragging. */}
      <div
        className="flex h-full min-w-0 flex-1 items-center gap-2 px-3"
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          void run(event.detail === 2 ? "toggleMaximize" : "startDragging");
        }}
      >
        <img src="/app-icon.png" alt="" draggable={false} className="pointer-events-none size-4 rounded" />
        <span className="pointer-events-none truncate text-caption-1-medium text-text-secondary">CC GUI</span>
        {failed && <span role="alert" className="pointer-events-none truncate text-caption-1-regular text-text-error-primary">{t("windowTitleBar.actionFailed")}</span>}
      </div>
      <button type="button" className={buttonClass} disabled={busy} aria-label={t("windowTitleBar.minimize")} title={t("windowTitleBar.minimize")} onClick={() => void run("minimize")}>
        <Minus className="size-3.5" aria-hidden />
      </button>
      <button type="button" className={buttonClass} disabled={busy} aria-label={maximizeLabel} title={maximizeLabel} onClick={() => void run("toggleMaximize")}>
        {maximized ? <Copy className="size-3" aria-hidden /> : <Square className="size-3" aria-hidden />}
      </button>
      <button type="button" className={`${buttonClass} hover:bg-red-600 hover:text-white`} aria-label={t("windowTitleBar.close")} title={t("windowTitleBar.close")} onClick={requestAppClose}>
        <X className="size-4" aria-hidden />
      </button>
    </header>
  );
}
