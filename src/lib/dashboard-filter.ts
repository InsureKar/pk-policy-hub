/** Restrict dashboard cards to the exact authorized deal set from Business Overview. */
export function selectDashboardDeals<T extends { id: string }>(deals: T[], dealIds: string[] | null): T[] {
  if (dealIds === null) return [];
  const selected = new Set(dealIds);
  return deals.filter((deal) => selected.has(deal.id));
}