import { createPortal } from "react-dom";
import { usePageChrome, usePageCrumbs, usePageTitle, type Crumb } from "@/components/page-chrome";

/** Registers the page title/crumbs and portals the description and actions into the shell header. */
export function PageHeader({
  title,
  description,
  actions,
  crumbs,
}: {
  title: string;
  crumbs?: Crumb[];
  description?: string;
  actions?: React.ReactNode;
}) {
  usePageTitle(title);
  usePageCrumbs(crumbs);
  const { slot } = usePageChrome();

  if (!slot || (!description && !actions)) return null;

  return createPortal(
    <div className="flex items-center justify-between gap-4 pb-3">
      <p className="min-w-0 text-sm text-muted-foreground">{description}</p>
      {actions}
    </div>,
    slot,
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
