import { getCurrentWindow } from "@tauri-apps/api/window";
import { isWeb } from "@/lib/transport";

export type WindowAction = "minimize" | "toggleMaximize" | "startDragging";

/** Lazy native boundary: importing this module never accesses a window handle. */
export async function performWindowAction(action: WindowAction): Promise<void> {
  if (isWeb) return;
  await getCurrentWindow()[action]();
}

/** Follow OS-driven changes too (shortcuts, double clicks, snapping).
 * Late registrations are disposed, and stale state queries cannot win races. */
export function watchWindowMaximized(
  onChange: (maximized: boolean) => void,
  onError: (error: unknown) => void,
): () => void {
  if (isWeb) return () => {};
  let disposed = false;
  let revision = 0;
  let unlisten: (() => void) | undefined;
  const report = (error: unknown) => { if (!disposed) onError(error); };
  try {
    const native = getCurrentWindow();
    const refresh = async () => {
      const request = ++revision;
      try {
        const value = await native.isMaximized();
        if (!disposed && request === revision) onChange(value);
      } catch (error) {
        if (request === revision) report(error);
      }
    };
    void native.onResized(() => { void refresh(); }).then((stop) => {
      if (disposed) stop();
      else {
        unlisten = stop;
        void refresh();
      }
    }).catch(report);
    void refresh();
  } catch (error) {
    report(error);
  }
  return () => {
    disposed = true;
    revision += 1;
    unlisten?.();
  };
}
