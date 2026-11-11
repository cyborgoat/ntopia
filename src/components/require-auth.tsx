import { PageHeader } from "@/components/page-header";
import { SignInNotice } from "@/components/sign-in-notice";
import { useAuth } from "@/lib/auth";
import { useT } from "@/i18n";

/** Gate Team Orbit pages: guests see a sign-in prompt instead of API calls. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const tr = useT();
  const { token } = useAuth();
  if (!token) {
    return (
      <>
        <PageHeader title={tr("page.teamOrbit")} />
        <SignInNotice>{tr("page.requireAuth")}</SignInNotice>
      </>
    );
  }
  return <>{children}</>;
}
