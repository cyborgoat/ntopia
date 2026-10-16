import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-dialog";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { applyServerUrl, errorMessage, getServerUrl, orbit } from "@/lib/orbit";

export const Route = createFileRoute("/_app/settings")({ component: Settings });

function Settings() {
  const { user, setUser, logout } = useAuth();
  const [name, setName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [server, setServer] = useState(getServerUrl());

  return (
    <>
      <PageHeader title="Settings" />
      <div className="max-w-md space-y-8">
        {user && (
          <>
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const { data, error } = await orbit.PATCH("/auth/me", { body: { fullName: name, email: email.trim() || null } });
              if (data) { setUser(data); toast.success("Profile updated"); } else toast.error(errorMessage(error));
            }}>
              <h2 className="text-sm font-medium">Profile</h2>
              <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Email (optional)"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Button type="submit" size="sm">Save profile</Button>
            </form>

            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const { error } = await orbit.POST("/auth/change-password", { body: pw });
              if (error) toast.error(errorMessage(error)); else { toast.success("Password changed"); setPw({ currentPassword: "", newPassword: "" }); }
            }}>
              <h2 className="text-sm font-medium">Password</h2>
              <Field label="Current password"><Input type="password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
              <Field label="New password"><Input type="password" required value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
              <Button type="submit" size="sm">Change password</Button>
            </form>
          </>
        )}

        <div className="space-y-4">
          <h2 className="text-sm font-medium">Server</h2>
          <Field label="Team Orbit URL"><Input type="url" placeholder="https://orbit.example.com" value={server} onChange={(e) => setServer(e.target.value)} /></Field>
          <div className="flex flex-wrap gap-2">
            {user ? (
              <>
                <Button size="sm" variant="outline" onClick={() => { void applyServerUrl(server); toast.success("Saved. Sign in again to apply."); logout(); }}>Save & sign out</Button>
                <Button size="sm" variant="ghost" onClick={logout}>Sign out</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => { void applyServerUrl(server); toast.success("Server URL saved"); }}>Save</Button>
                <Button size="sm" render={<Link to="/login" />}>Sign in</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
