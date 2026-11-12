/** Only changed client information is updated; ownership and deal records are never included. */
export function changedClientFields<T extends Record<string, unknown>>(before: T, after: T): Partial<T> {
  return Object.fromEntries(Object.entries(after).filter(([key, value]) => before[key] !== value)) as Partial<T>;
}