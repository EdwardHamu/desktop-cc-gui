import { useCallback, useEffect, useRef, useState } from "react";
import { performWindowAction, watchWindowMaximized, type WindowAction } from "./native-window";

export function useWindowChrome() {
  const [maximized, setMaximized] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const stop = watchWindowMaximized(setMaximized, (error) => {
      console.warn("[window-chrome] state subscription failed", error);
      setFailed(true);
    });
    return () => {
      mounted.current = false;
      stop();
    };
  }, []);

  const run = useCallback(async (action: WindowAction) => {
    if (inFlight.current || !mounted.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await performWindowAction(action);
    } catch (error) {
      console.warn(`[window-chrome] ${action} failed`, error);
      if (mounted.current) setFailed(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);

  return { maximized, failed, busy, run };
}
