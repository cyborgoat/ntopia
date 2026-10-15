import { useState } from "react";
import { Link, Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { getServerUrl, resetOrbit, setServerUrl } from "@/lib/orbit";

export const Route = createFileRoute("/login")({ component: Login });

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-sm">
        <div className="mb-5">
          <div className="text-xs font-semibold tracking-widest text-muted-foreground">NTOPIA</div>
          <h1 className="mt-1 text-lg font-semibold">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

function Login() {
  const { login, token } = useAuth();
  const navigate = useNavigate();
  const [server, setServer] = useState(getServerUrl());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (token) return <Navigate to="/" />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await setServerUrl(server);
      resetOrbit();
      await login(email, password);
      navigate({ to: "/" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Sign in">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="server">Server</Label>
          <Input id="server" value={server} onChange={(e) => setServer(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
        <p className="text-center text-sm text-muted-foreground">
          No account? <Link to="/register" className="underline">Register</Link>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/" className="underline">Continue without signing in</Link>
        </p>
      </form>
    </AuthCard>
  );
}
