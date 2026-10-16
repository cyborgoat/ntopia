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
    <div className="mb-6 flex items-start justify-between gap-4">
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
