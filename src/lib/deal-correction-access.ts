/** Presentation gates only; authenticated database policies enforce writes. */
export function canCorrectDealRecords(roles: readonly string[]) {
  return roles.includes("admin") || roles.includes("management");
}

export function canEditDealInstalment(manager: boolean, canEdit: boolean, unsaved: boolean, index: number, firstUnpaid: number) {
  return manager || (canEdit && (unsaved || index === firstUnpaid));
}

export function dealPlanPeriodLimit(schedule: string | null | undefined) {
  const value = String(schedule ?? "").toLowerCase();
  if (/^(custom|quarter)/.test(value)) return 4;
  if (/^(bi-annual|bi annual|half)/.test(value)) return 2;
  if (value.startsWith("month")) return 12;
  return 0;
}