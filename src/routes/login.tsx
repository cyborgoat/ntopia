import { useState } from "react";
import { toMessage } from "@/lib/utils";
import { Link, Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/components/auth-card";
import { useAuth } from "@/lib/auth";
import { applyServerUrl, getServerUrl } from "@/lib/orbit";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { login, token } = useAuth();
  const navigate = useNavigate();
  const [server, setServer] = useState(getServerUrl());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (token) return <Navigate to="/" />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await applyServerUrl(server);
      await login(username, password);
      navigate({ to: "/" });
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Sign in">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="server">Server</Label>
          <Input id="server" type="url" required placeholder="https://orbit.example.com" value={server} onChange={(e) => setServer(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">Username or email</Label>
          <Input id="username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
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
