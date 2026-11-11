import { useState } from "react";
import { toast } from "sonner";
import { AvatarSettings } from "@/components/avatar-settings";
import { Field } from "@/components/form-dialog";
import { SignInNotice } from "@/components/sign-in-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { errorMessage, getServerUrl, orbit } from "@/lib/orbit";
import { Group } from "./layout";

function ProfileForm() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  return (
    <Group title="Profile" description="How you appear to your team.">
      <div className="flex items-center gap-4">
        <AvatarSettings />
        <div className="text-sm">
          <div className="font-medium">{user?.fullName}</div>
          <div className="text-muted-foreground">@{user?.username}</div>
        </div>
      </div>
      <form
        className="max-w-sm space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const { data, error } = await orbit.PATCH("/api/auth/me", { body: { fullName: name, email: email.trim() || null } });
          if (data) { setUser(data); toast.success("Profile updated"); } else toast.error(errorMessage(error));
        }}
      >
        <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email (optional)"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Button type="submit" size="sm">Save profile</Button>
      </form>
    </Group>
  );
}

function PasswordForm() {
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });

  return (
    <Group title="Password" description="Change the password you use to sign in.">
      <form
        className="max-w-sm space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await orbit.POST("/api/auth/change-password", { body: pw });
          if (error) toast.error(errorMessage(error)); else { toast.success("Password changed"); setPw({ currentPassword: "", newPassword: "" }); }
        }}
      >
        <Field label="Current password"><Input type="password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
        <Field label="New password"><Input type="password" required value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
        <Button type="submit" size="sm">Change password</Button>
      </form>
    </Group>
  );
}

export function AccountSettings() {
  const { token, user, unreachable, logout } = useAuth();

  if (!token) {
    return <SignInNotice>Sign in to manage your Team Orbit profile and password.</SignInNotice>;
  }
  return (
    <>
      {user && <ProfileForm />}
      {user && <PasswordForm />}
      <Group title="Connection" description="The Team Orbit server this app talks to.">
        <div className="text-sm">
          <div className="break-all font-mono text-xs">{getServerUrl() || "Not set"}</div>
          <div className={unreachable ? "mt-1 text-destructive" : "mt-1 text-muted-foreground"}>
            {unreachable ? "Can't reach the server." : user ? "Connected." : "Connecting…"}
          </div>
        </div>
      </Group>
      <Group title="Sign out" description="You'll need to sign in again to use Team Orbit.">
        <Button variant="outline" size="sm" onClick={logout}>Sign out</Button>
      </Group>
    </>
  );
}
