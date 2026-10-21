import { Link } from "@tanstack/react-router";
import { excerpt } from "@/lib/utils";

/**
 * Shared list row for news, blog and discussions: title, author · date, a short excerpt.
 * Each feed adds its own decoration via `leading` (cover), `aside` (votes/comments) and `footer` (tags).
 */
export function FeedCard({
  to,
  params,
  title,
  author,
  createdAt,
  content,
  leading,
  aside,
  footer,
  action,
}: {
  to: string;
  params: Record<string, string>;
  title: string;
  author: string;
  createdAt: string;
  content: string;
  leading?: React.ReactNode;
  aside?: React.ReactNode;
  footer?: React.ReactNode;
  /** Floating control (e.g. delete) in the top-right corner. */
  action?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Link
        to={to}
        params={params}
        className="flex items-stretch overflow-hidden rounded-lg border transition-colors hover:bg-muted/50"
      >
        {leading}
        <div className="min-w-0 flex-1 space-y-1 px-3.5 py-2.5">
          <h2 className={`truncate text-sm font-semibold tracking-tight ${action ? "pr-9" : ""}`}>{title}</h2>
          <p className="text-xs text-muted-foreground">{author} · {new Date(createdAt).toLocaleDateString()}</p>
          <p className="line-clamp-1 text-sm text-muted-foreground">{excerpt(content, 140)}</p>
          {footer}
        </div>
        {aside && <div className="flex shrink-0 items-center gap-3 pr-4 text-sm text-muted-foreground">{aside}</div>}
      </Link>
      {action && <div className="absolute top-2 right-2">{action}</div>}
    </div>
  );
}
