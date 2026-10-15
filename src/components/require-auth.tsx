import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Empty, PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth";

/** Gate Team Orbit pages: guests see a sign-in prompt instead of API calls. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) {
    return (
      <>
        <PageHeader title="Sign in required" description="This feature needs a Team Orbit account." />
        <Empty>
          <p className="mb-4">Sign in to access team announcements, events, and discussions.</p>
          <Button render={<Link to="/login" />} size="sm">
            Sign in
          </Button>
        </Empty>
      </>
    );
  }
  return <>{children}</>;
}
