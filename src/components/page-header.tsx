import { createPortal } from "react-dom";
import { usePageChrome, usePageCrumbs, usePageTitle, type Crumb } from "@/components/page-chrome";

/** Registers the page title/crumbs and portals the actions into the right of the shell header's title row. */
export function PageHeader({
  title,
  actions,
  crumbs,
}: {
  title: string;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
}) {
  usePageTitle(title);
  usePageCrumbs(crumbs);
  const { slot } = usePageChrome();

  return slot && actions ? createPortal(actions, slot) : null;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
