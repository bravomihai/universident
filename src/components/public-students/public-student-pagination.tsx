import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  publicStudentPaginationItems,
  publicStudentSearchHref,
} from "@/lib/public-students/public-student-search-pagination";

type PublicStudentPaginationProps = {
  page: number;
  totalPages: number;
  treatmentSlug: string;
  citySlug: string;
};

function PaginationList({ page, totalPages, treatmentSlug, citySlug, compact }: PublicStudentPaginationProps & { compact: boolean }) {
  const href = (target: number) => publicStudentSearchHref(treatmentSlug, citySlug, target);
  return (
    <ul className={`${compact ? "flex sm:hidden" : "hidden sm:flex"} items-center justify-center gap-1`}>
      <li>
        {page > 1 ? (
          <Button asChild variant="outline" size="icon">
            <Link href={href(page - 1)} prefetch={false} rel="prev" aria-label="Pagina anterioară">
              <ChevronLeft aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" size="icon" disabled aria-label="Pagina anterioară">
            <ChevronLeft aria-hidden="true" />
          </Button>
        )}
      </li>
      {publicStudentPaginationItems(page, totalPages, compact).map((item) => (
        <li key={item}>
          {typeof item === "number" ? (
            <Button asChild variant={item === page ? "default" : "outline"} size="icon" className="tabular-nums">
              <Link
                href={href(item)}
                prefetch={false}
                aria-label={item === page ? `Pagina ${item}, pagina curentă` : `Pagina ${item}`}
                aria-current={item === page ? "page" : undefined}
              >
                {item}
              </Link>
            </Button>
          ) : (
            <span className="inline-flex h-11 w-5 items-center justify-center text-muted-foreground">
              <span aria-hidden="true">…</span>
              <span className="sr-only">Pagini intermediare</span>
            </span>
          )}
        </li>
      ))}
      <li>
        {page < totalPages ? (
          <Button asChild variant="outline" size="icon">
            <Link href={href(page + 1)} prefetch={false} rel="next" aria-label="Pagina următoare">
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" size="icon" disabled aria-label="Pagina următoare">
            <ChevronRight aria-hidden="true" />
          </Button>
        )}
      </li>
    </ul>
  );
}

export function PublicStudentPagination(props: PublicStudentPaginationProps) {
  if (props.totalPages <= 1) return null;
  return (
    <nav aria-label="Paginarea rezultatelor" className="flex justify-center">
      <PaginationList {...props} compact />
      <PaginationList {...props} compact={false} />
    </nav>
  );
}
