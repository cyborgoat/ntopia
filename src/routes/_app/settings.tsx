import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { KeyRound, Server, UserRound, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { AvatarSettings } from "@/components/avatar-settings";
import { Field } from "@/components/form-dialog";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { applyServerUrl, errorMessage, getServerUrl, orbit } from "@/lib/orbit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/settings")({ component: Settings });

type SectionId = "profile" | "password" | "server";
const SECTIONS: { id: SectionId; label: string; icon: LucideIcon; account: boolean }[] = [
  { id: "profile", label: "Profile", icon: UserRound, account: true },
  { id: "password", label: "Password", icon: KeyRound, account: true },
  { id: "server", label: "Server", icon: Server, account: false },
];

function Settings() {
  const { user } = useAuth();
  const sections = SECTIONS.filter((s) => user || !s.account);
  const [active, setActive] = useState<SectionId>(sections[0].id);
  const current = sections.some((s) => s.id === active) ? active : sections[0].id;

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 md:grid-cols-[11rem_1fr]">
        <nav aria-label="Settings sections" className="flex gap-1 md:flex-col">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={current === id ? "page" : undefined}
              onClick={() => setActive(id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                current === id && "bg-muted font-medium",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 max-w-lg">
          {current === "profile" && <ProfileSection />}
          {current === "password" && <PasswordSection />}
          {current === "server" && <ServerSection />}
        </div>
      </div>
    </>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <div className="border-b pb-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
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
            <Button size="sm" render={<Link to="/login" />}>Sign in</Button>
          </>
        )}
      </div>
    </Section>
  );
}
