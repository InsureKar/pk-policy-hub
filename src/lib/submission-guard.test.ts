import { describe, expect, it } from "vitest";
import { createSubmissionGuard } from "./submission-guard";

describe("deal submission guard", () => {
  it("allows one save among simultaneous click and keyboard attempts", async () => {
    const guard = createSubmissionGuard();
    let writes = 0;
    let finish: (() => void) | undefined;
    const slowRequest = new Promise<void>((resolve) => { finish = resolve; });
    const save = async () => {
      if (!guard.acquire()) return;
      try { writes++; await slowRequest; } finally { guard.release(); }
    };
    const attempts = Array.from({ length: 20 }, () => save());
    expect(writes).toBe(1);
    finish?.();
    await Promise.all(attempts);
    await save();
    expect(writes).toBe(2);
  });
  it("releases after failure so the user can retry", async () => {
    const guard = createSubmissionGuard();
    const save = async () => {
      if (!guard.acquire()) return;
      try { throw new Error("network unavailable"); } finally { guard.release(); }
    };
    await expect(save()).rejects.toThrow("network unavailable");
    expect(guard.acquire()).toBe(true);
  });
});