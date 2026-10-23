/** Acquires synchronously, before React can repaint or an async request starts. */
export function createSubmissionGuard() {
  let active = false;
  return {
    acquire() { if (active) return false; active = true; return true; },
    release() { active = false; },
  };
}