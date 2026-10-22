import { useState } from "react";
import { toast } from "sonner";
import { AvatarSettings } from "@/components/avatar-settings";
import { Field } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuthDialog } from "@/components/auth-dialog";
import { useAuth } from "@/lib/auth";
import { applyServerUrl, errorMessage, getServerUrl, orbit } from "@/lib/orbit";

export type SettingsPanel = "profile" | "password" | "server";

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="space-y-5">{children}</div>
    </>
  );
}

function ProfileSection() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  return (
    <Section title="Profile" description="How you appear to your team.">
      <div className="flex items-center gap-4">
        <AvatarSettings />
        <div className="text-sm">
          <div className="font-medium">{user?.fullName}</div>
          <div className="text-muted-foreground">@{user?.username}</div>
        </div>
      </div>
      <form
        className="space-y-4"
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
    </Section>
  );
}

function PasswordSection() {
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });

  return (
    <Section title="Password" description="Change the password you use to sign in.">
      <form
        className="space-y-4"
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
    </Section>
  );
}

function ServerSection() {
  const { user, logout } = useAuth();
  const openAuth = useAuthDialog();
  const [server, setServer] = useState(getServerUrl());

  return (
    <Section title="Server" description="The Team Orbit server this app connects to.">
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
            <Button size="sm" onClick={() => openAuth("login")}>Sign in</Button>
          </>
        )}
      </div>
    </Section>
  );
}

const PANELS = { profile: ProfileSection, password: PasswordSection, server: ServerSection };

export function SettingsDialog({ panel, onClose }: { panel: SettingsPanel | null; onClose: () => void }) {
  const Panel = panel ? PANELS[panel] : null;
  return (
    <Dialog open={!!panel} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">{Panel && <Panel />}</DialogContent>
    </Dialog>
  );
}
