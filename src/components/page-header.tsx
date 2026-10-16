import { usePageCrumbs, usePageTitle, type Crumb } from "@/components/page-chrome";

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

  if (!description && !actions) return null;

  return (
    <div className="sticky top-0 z-10 -mx-8 -mt-4 mb-4 flex items-start justify-between gap-4 border-b bg-background/95 px-8 pt-4 pb-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
