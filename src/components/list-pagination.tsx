import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export const PAGE_SIZE = 10;

// Page numbers to show: first, last, and a window around the current page.
function pageList(page: number, pages: number): (number | "gap")[] {
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  const out: (number | "gap")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (keep.has(p)) out.push(p);
    else if (out[out.length - 1] !== "gap") out.push("gap");
  }
  return out;
}

export function ListPagination({
  page,
  total,
  limit = PAGE_SIZE,
  onPageChange,
}: {
  page: number;
  total: number | undefined;
  limit?: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil((total ?? 0) / limit));
  if (pages <= 1) return null;

  return (
    <Pagination className="pt-6">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
        </PaginationItem>
        {pageList(page, pages).map((p, i) => (
          <PaginationItem key={p === "gap" ? `gap-${i}` : p}>
            {p === "gap" ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink isActive={p === page} onClick={() => onPageChange(p)}>{p}</PaginationLink>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext disabled={page >= pages} onClick={() => onPageChange(page + 1)} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
