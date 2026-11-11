import { useState } from "react";
import { toast } from "sonner";
import { AvatarSettings } from "@/components/avatar-settings";
import { Field } from "@/components/form-dialog";
import { SignInNotice } from "@/components/sign-in-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { errorMessage, getServerUrl, orbit } from "@/lib/orbit";
import { Group } from "./layout";

function ProfileForm() {
  const tr = useT();
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  return (
    <Group title={tr("settings.profile")} description={tr("settings.profileHint")}>
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
          if (data) { setUser(data); toast.success(tr("settings.profileUpdated")); } else toast.error(errorMessage(error));
        }}
      >
        <Field label={tr("settings.fullName")}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={tr("settings.emailOptional")}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Button type="submit" size="sm">{tr("settings.saveProfile")}</Button>
      </form>
    </Group>
  );
}

function PasswordForm() {
  const tr = useT();
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });

  return (
    <Group title={tr("settings.password")} description={tr("settings.passwordHint")}>
      <form
        className="max-w-sm space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await orbit.POST("/api/auth/change-password", { body: pw });
          if (error) toast.error(errorMessage(error)); else { toast.success(tr("settings.passwordChanged")); setPw({ currentPassword: "", newPassword: "" }); }
        }}
      >
        <Field label={tr("settings.currentPassword")}><Input type="password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
        <Field label={tr("settings.newPassword")}><Input type="password" required value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
        <Button type="submit" size="sm">{tr("settings.changePassword")}</Button>
      </form>
    </Group>
  );
}

export function AccountSettings() {
  const tr = useT();
  const { token, user, unreachable, logout } = useAuth();

  if (!token) {
    return <SignInNotice>{tr("settings.signInToManage")}</SignInNotice>;
  }
  return (
    <>
      {user && <ProfileForm />}
      {user && <PasswordForm />}
      <Group title={tr("settings.connection")} description={tr("settings.connectionHint")}>
        <div className="text-sm">
          <div className="break-all font-mono text-xs">{getServerUrl() || tr("settings.notSet")}</div>
          <div className={unreachable ? "mt-1 text-destructive" : "mt-1 text-muted-foreground"}>
            {unreachable ? tr("settings.cantReach") : user ? tr("settings.connected") : tr("settings.connecting")}
          </div>
        </div>
      </Group>
      <Group title={tr("settings.signOut")} description={tr("settings.signOutHint")}>
        <Button variant="outline" size="sm" onClick={logout}>{tr("settings.signOut")}</Button>
      </Group>
    </>
  );
}
