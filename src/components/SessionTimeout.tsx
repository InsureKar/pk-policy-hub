import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const IDLE_LIMIT_MS = 15 * 60 * 1000;
export const WARNING_MS = 60 * 1000;
export const LAST_ACTIVITY_KEY = "crm:last-activity";
export const EXPIRED_FLAG_KEY = "crm:session-expired";
const LOGOUT_KEY = "crm:logout-broadcast";
const EVENTS = ["mousedown", "keydown", "wheel", "touchstart", "scroll", "pointermove"] as const;

export function markActivityNow() {
  try { localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())); } catch { /* ignore */ }
}
function readLast(): number | null {
  const v = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Inactivity timeout, synchronized across tabs via localStorage. */
export function SessionTimeout() {
  const [warn, setWarn] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const done = useRef(false);
  const lastWrite = useRef(0);

  const logout = useCallback(async (expired: boolean) => {
    if (done.current) return;
    done.current = true;
    try {
      if (expired) localStorage.setItem(EXPIRED_FLAG_KEY, "1");
      localStorage.setItem(LOGOUT_KEY, String(Date.now()));
    } catch { /* ignore */ }
    // Revokes this session's refresh token on the auth server and clears local tokens.
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    window.location.replace("/auth");
  }, []);

  useEffect(() => {
    const last = readLast();
    if (last !== null && Date.now() - last >= IDLE_LIMIT_MS) { void logout(true); return; }
    if (last === null) markActivityNow();

    const onActivity = () => {
      if (done.current) return;
      const now = Date.now();
      const l = readLast() ?? now;
      // While the warning is open, only the explicit buttons extend the session.
      if (now - l >= IDLE_LIMIT_MS - WARNING_MS) return;
      if (now - lastWrite.current > 1000) { lastWrite.current = now; markActivityNow(); }
    };
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const tick = window.setInterval(() => {
      const l = readLast() ?? Date.now();
      const idle = Date.now() - l;
      if (idle >= IDLE_LIMIT_MS) { void logout(true); return; }
      if (idle >= IDLE_LIMIT_MS - WARNING_MS) {
        setWarn(true);
        setSecondsLeft(Math.max(0, Math.ceil((IDLE_LIMIT_MS - idle) / 1000)));
      } else setWarn(false);
    }, 1000);

    const onStorage = (e: StorageEvent) => {
      if (e.key === LOGOUT_KEY && !done.current) {
        done.current = true;
        void supabase.auth.signOut({ scope: "local" }).catch(() => undefined)
          .finally(() => window.location.replace("/auth"));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(tick);
      window.removeEventListener("storage", onStorage);
    };
  }, [logout]);

  const stay = async () => {
    // Verify the session is still valid on the server and refresh tokens.
    const { error } = await supabase.auth.refreshSession();
    if (error) { void logout(true); return; }
    markActivityNow();
    setWarn(false);
  };

  return (
    <Dialog open={warn} onOpenChange={() => { /* explicit choice required */ }}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Session timeout</DialogTitle>
          <DialogDescription>
            Your session is about to expire due to inactivity. You will be logged out in {secondsLeft} seconds.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => void logout(false)}>Log Out</Button>
          <Button onClick={() => void stay()}>Stay Logged In</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
