import { useRef, useState } from "react";
import { createSubmissionGuard } from "./submission-guard";

export function useSaveGuard() {
  const guard = useRef(createSubmissionGuard());
  const [saving, setSaving] = useState(false);
  return {
    saving,
    begin() {
      if (!guard.current.acquire()) return false;
      setSaving(true);
      return true;
    },
    end() { guard.current.release(); setSaving(false); },
  };
}