export const PROFILE_REFRESH_COOLDOWN_HOURS = 20;
export const PROFILE_REFRESH_COOLDOWN_MS =
  PROFILE_REFRESH_COOLDOWN_HOURS * 60 * 60 * 1000;

export function nextProfileRefreshAt(lastRefreshedAt: Date) {
  return new Date(
    lastRefreshedAt.getTime() + PROFILE_REFRESH_COOLDOWN_MS,
  );
}
