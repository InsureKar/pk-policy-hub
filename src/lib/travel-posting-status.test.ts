import { describe, expect, it } from "vitest";
import { canManagePostingStatus, DEFAULT_POSTING_SENT_STATUS, matchesPostingStatus, postingSentStatus } from "./travel-posting-status";

describe("Travel Posting delivery status", () => {
  it("allows only Admin and Management", () => {
    expect(canManagePostingStatus(["admin"])).toBe(true);
    expect(canManagePostingStatus(["management"])).toBe(true);
    expect(canManagePostingStatus(["do", "team_lead"])).toBe(false);
    expect(canManagePostingStatus([])).toBe(false);
  });
  it("defaults new and untracked postings to Unsent", () => {
    expect(DEFAULT_POSTING_SENT_STATUS).toBe("unsent");
    expect(postingSentStatus(undefined)).toBe("unsent");
    expect(postingSentStatus(null)).toBe("unsent");
  });
  it("filters All, Sent and Unsent without including opposite statuses", () => {
    expect(matchesPostingStatus("sent", "all")).toBe(true);
    expect(matchesPostingStatus("unsent", "all")).toBe(true);
    expect(matchesPostingStatus("sent", "sent")).toBe(true);
    expect(matchesPostingStatus("unsent", "sent")).toBe(false);
    expect(matchesPostingStatus("sent", "unsent")).toBe(false);
    expect(matchesPostingStatus(undefined, "unsent")).toBe(true);
  });
});