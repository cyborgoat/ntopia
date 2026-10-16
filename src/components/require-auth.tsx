import { PageHeader } from "@/components/page-header";
import { SignInNotice } from "@/components/sign-in-notice";
import { useAuth } from "@/lib/auth";

/** Gate Team Orbit pages: guests see a sign-in prompt instead of API calls. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) {
    return (
      <>
        <PageHeader title="Team Orbit" />
        <SignInNotice>Sign in to access team announcements, events, news and discussions.</SignInNotice>
      </>
    );
  }
  return <>{children}</>;
}
