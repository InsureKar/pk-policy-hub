export type PostingSentStatus = "sent" | "unsent";
export type PostingStatusFilter = "all" | PostingSentStatus;
export const DEFAULT_POSTING_SENT_STATUS: PostingSentStatus = "unsent";

export function canManagePostingStatus(roles: readonly string[]) {
  return roles.includes("admin") || roles.includes("management");
}

export function postingSentStatus(value: string | null | undefined): PostingSentStatus {
  return value === "sent" ? "sent" : DEFAULT_POSTING_SENT_STATUS;
}

export function matchesPostingStatus(value: string | null | undefined, filter: PostingStatusFilter) {
  return filter === "all" || postingSentStatus(value) === filter;
}