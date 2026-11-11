import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthDialog } from "@/components/auth-dialog";
import { useT } from "@/i18n";

/** Prominent banner telling guests that Team Orbit features need an account. */
export function SignInNotice({ children }: { children: React.ReactNode }) {
  const openAuth = useAuthDialog();
  const tr = useT();
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <LogIn className="size-5 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-sm">{children}</p>
      <Button onClick={() => openAuth("login")} size="sm">
        {tr("common.signInToOrbit")}
      </Button>
    </div>
  );
}
