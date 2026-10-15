// Pure, DB-free engagement date logic — safe to unit test directly
// (lib/overload.test.ts). Engagements are a reference roster with no
// intensity/allocation, so all that's left here is "is this person on the
// project right now".

/**
 * "Active" means today falls within the engagement's own date range.
 * Open-ended bounds count as ongoing. The end date is inclusive — dates are
 * stored at midnight, so someone whose last day is today is still on it.
 */
export function isCurrentlyActive(e: { startDate: Date | null; endDate: Date | null }, today: Date = new Date()): boolean {
  if (e.startDate && today < e.startDate) return false;
  if (e.endDate && today.getTime() >= e.endDate.getTime() + 86_400_000) return false;
  return true;
}
