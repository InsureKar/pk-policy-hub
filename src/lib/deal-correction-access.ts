/** Presentation gates only; authenticated database policies enforce writes. */
export function canCorrectDealRecords(roles: readonly string[]) {
  return roles.includes("admin") || roles.includes("management");
}

export function canEditDealInstalment(manager: boolean, canEdit: boolean, unsaved: boolean, index: number, firstUnpaid: number) {
  return manager || (canEdit && (unsaved || index === firstUnpaid));
}