import { Link, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/page-header";
import { usePageCrumbs, usePageTitle } from "@/components/page-chrome";
import { useAuth } from "@/lib/auth";

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
  section: { label: string; to: "/announcements" | "/events" | "/news" | "/blog" };
  itemTitle?: string;
  loading: boolean;
  notFound: boolean;
  onDelete?: () => Promise<unknown>;
  children: React.ReactNode;
}) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  usePageTitle(section.label);
  usePageCrumbs([
    { label: "Home", to: "/" },
    { label: section.label, to: section.to },
    { label: itemTitle ?? (notFound ? "Not found" : "…") },
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
        This item doesn't exist or was removed.{" "}
        <Link to={section.to} className="underline">Back to {section.label.toLowerCase()}</Link>
      </Empty>
    );
  }
  return (
    <article className="space-y-4">
      {children}
      {isAdmin && onDelete && (
        <div className="border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await onDelete();
              await navigate({ to: section.to });
            }}
          >
            <Trash2 /> Delete
          </Button>
        </div>
      )}
    </article>
  );
}
