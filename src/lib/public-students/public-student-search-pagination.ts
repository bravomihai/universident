export type PaginationItem = number | `gap-${number}`;

export function publicStudentSearchHref(treatmentSlug: string, citySlug: string, page = 1) {
  const params = new URLSearchParams({ tratament: treatmentSlug, oras: citySlug });
  if (page > 1) params.set("pagina", String(page));
  return `/studenti?${params.toString()}`;
}

export function publicStudentPaginationItems(
  currentPage: number,
  totalPages: number,
  compact = false,
): PaginationItem[] {
  if (!Number.isSafeInteger(totalPages) || totalPages < 1) return [];
  const current = Math.min(totalPages, Math.max(1, Number.isSafeInteger(currentPage) ? currentPage : 1));
  const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, index) => start + index);

  if (totalPages <= (compact ? 4 : 7)) return range(1, totalPages);

  let pages: number[];
  if (compact) {
    // At most three numbered targets and two narrow gaps fit a 320px screen
    // while keeping the previous/next controls and all links 44px wide.
    pages = [1, Math.max(2, Math.min(current, totalPages - 1)), totalPages];
  } else if (current <= 4) {
    pages = [...range(1, 5), totalPages];
  } else if (current >= totalPages - 3) {
    pages = [1, ...range(totalPages - 4, totalPages)];
  } else {
    pages = [1, current - 1, current, current + 1, totalPages];
  }

  return pages.flatMap<PaginationItem>((page, index) => {
    const previous = pages[index - 1];
    return previous !== undefined && page - previous > 1
      ? [`gap-${previous}`, page]
      : [page];
  });
}
