import { Link } from "@tanstack/react-router";
import { excerpt } from "@/lib/utils";

/**
 * Shared list card for Orbit feeds: title, author · date (or custom `meta`), a short excerpt, and a bottom row with
 * `footer` (tags, location) on the left and `stats` on the right. Every card has the same height, whatever it contains.
 * Each feed adds its own decoration via `leading` (cover/date), `stats` (votes/comments/views) and `footer` (tags).
 */
export function FeedCard({
  to,
  params,
  title,
  author,
  createdAt,
  content,
  meta,
  leading,
  stats,
  footer,
  action,
}: {
  to: string;
  params: Record<string, string>;
  title: string;
  author: string;
  createdAt: string;
  content: string;
  /** Replaces the default author · date line when set (e.g. event location). */
  meta?: React.ReactNode;
  leading?: React.ReactNode;
  /** Counters (votes, comments, views) at the right of the bottom row. */
  stats?: React.ReactNode;
  footer?: React.ReactNode;
  /** Floating control (e.g. delete) in the top-right corner; shown only while the card is hovered or focused. */
  action?: React.ReactNode;
}) {
  return (
    <div className="group/card relative w-full">
      <Link
        to={to}
        params={params}
        className="flex h-32 w-full items-stretch overflow-hidden rounded-lg border transition-colors hover:bg-muted/50"
      >
        {leading}
        <div className="flex min-w-0 flex-1 flex-col gap-1 px-3.5 py-2.5">
          <h2 className={`truncate text-sm font-semibold tracking-tight ${action ? "pr-9" : ""}`}>{title}</h2>
          {meta ?? (
            <p className="truncate text-xs text-muted-foreground">{author} · {new Date(createdAt).toLocaleDateString()}</p>
          )}
          <p className="line-clamp-2 text-sm text-muted-foreground">{excerpt(content, 200)}</p>
          <div className="mt-auto flex min-h-5 items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="min-w-0 flex-1 overflow-hidden">{footer}</div>
            {stats && <div className="flex shrink-0 items-center gap-4">{stats}</div>}
          </div>
        </div>
      </Link>
      {action && (
        <div className="absolute top-2 right-2 opacity-0 transition-opacity group-focus-within/card:opacity-100 group-hover/card:opacity-100">
          {action}
        </div>
      )}
    </div>
  );
}
