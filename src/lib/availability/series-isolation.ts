export async function runSeriesOperationsIsolated(
  seriesIds: string[],
  operation: (seriesId: string) => Promise<void>,
  onError: (seriesId: string, error: unknown) => void,
) {
  for (const seriesId of seriesIds) {
    try {
      await operation(seriesId);
    } catch (error) {
      onError(seriesId, error);
    }
  }
}
