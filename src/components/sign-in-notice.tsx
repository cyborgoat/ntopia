import { Link } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Prominent banner telling guests that Team Orbit features need an account. */
export function SignInNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <LogIn className="size-5 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-sm">{children}</p>
      <Button render={<Link to="/login" />} size="sm">
        Sign in to Team Orbit
      </Button>
    </div>
  );
}
