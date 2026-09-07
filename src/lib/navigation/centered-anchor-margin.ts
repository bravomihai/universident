type CenteredAnchorMeasurements = {
  viewportHeight: number;
  targetHeight: number;
  headerHeight: number;
  scrollPaddingTop: number;
};

// Native hash navigation already adds the root's scroll-padding-top. Add only
// the remaining space needed to center the target below the sticky header.
export function centeredAnchorMargin({
  viewportHeight, targetHeight, headerHeight, scrollPaddingTop,
}: CenteredAnchorMeasurements) {
  const visibleCenter = headerHeight + Math.max(0, viewportHeight - headerHeight) / 2;
  return Math.max(0, visibleCenter - targetHeight / 2 - scrollPaddingTop);
}
