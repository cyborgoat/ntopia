import { Link } from "@tanstack/react-router";
import { gadgets } from "@/gadgets/registry";

export function GadgetGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {gadgets.map((g) => (
        <Link key={g.id} to={g.to} className="rounded-lg border p-5 transition-colors hover:bg-muted/50">
          <g.icon className="mb-3 size-5" />
          <div className="font-medium">{g.name}</div>
          <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>
        </Link>
      ))}
    </div>
  );
}
