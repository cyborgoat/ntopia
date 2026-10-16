export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-sm">
        <div className="mb-5">
          <div className="text-xs font-semibold tracking-widest text-muted-foreground">NTOPIA</div>
          <h1 className="mt-1 text-lg font-semibold">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
