import { Link, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/page-header";
import { usePageCrumbs, usePageTitle } from "@/components/page-chrome";
import { useAuth } from "@/lib/auth";
import { assetUrl } from "@/lib/orbit";
import { formatDateTime } from "@/lib/utils";
import { t, useT, type MessageKey } from "@/i18n";

/** Page title of a single item. */
export function DetailTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="text-xl font-semibold tracking-tight">{children}</h1>;
}

/** "Author · date" line, optionally followed by a view count. */
export function Byline({ author, createdAt, views }: { author: string; createdAt: string; views?: number }) {
  useT();
  return (
    <p className="text-xs text-muted-foreground">
      {author} · {formatDateTime(createdAt)}
      {views !== undefined && ` · ${t(views === 1 ? "stat.view1" : "stat.viewN", { n: views })}`}
    </p>
  );
}

export function CoverImage({ src }: { src?: string | null }) {
  return src ? <img src={assetUrl(src)} alt="" className="h-56 w-full rounded-lg object-cover" /> : null;
}

/** Hairline between a page's main content and a secondary section. */
export function Divider() {
  return <hr className="my-6 border-border/60" />;
}

/**
 * Shared frame for a single Team Orbit item: breadcrumbs
 * (Home / Section / item), loading and not-found states, admin delete.
 */
export function DetailPage({
  section,
  itemTitle,
  loading,
  notFound,
  onDelete,
  children,
}: {
  section: { label: MessageKey; to: "/announcements" | "/events" | "/news" | "/blog" | "/discussions" };
  itemTitle?: string;
  loading: boolean;
  notFound: boolean;
  onDelete?: () => Promise<unknown>;
  children: React.ReactNode;
}) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const tr = useT();
  usePageTitle(tr(section.label));
  usePageCrumbs([
    { label: tr("nav.home"), to: "/" },
    { label: tr(section.label), to: section.to },
    { label: itemTitle ?? (notFound ? tr("feed.notFound") : "…") },
  ]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (notFound) {
    return (
      <Empty>
        {tr("feed.itemMissing")}{" "}
        <Link to={section.to} className="underline">{tr("feed.backTo", { section: tr(section.label).toLowerCase() })}</Link>
      </Empty>
    );
  }
  return (
    <article className="space-y-5">
      {children}
      {isAdmin && onDelete && (
        <div>
          <Divider />
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await onDelete();
              await navigate({ to: section.to });
            }}
          >
            <Trash2 /> {tr("common.delete")}
          </Button>
        </div>
      )}
    </article>
  );
}
