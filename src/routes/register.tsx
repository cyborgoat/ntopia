import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { resetOrbit, setServerUrl, getServerUrl } from "@/lib/orbit";
import { AuthCard } from "./login";

export const Route = createFileRoute("/register")({ component: Register });

function Register() {
  const { register } = useAuth();
  const [f, setF] = useState({ username: "", fullName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      setServerUrl(getServerUrl());
      resetOrbit();
      await register(f);
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (done)
    return (
      <AuthCard title="Request received">
        <p className="text-sm text-muted-foreground">
          Your account is pending activation. An admin needs to approve it before you can sign in.
        </p>
        <Button render={<Link to="/login" />} variant="outline" className="mt-4 w-full">
          Back to sign in
        </Button>
      </AuthCard>
    );

  return (
    <AuthCard title="Create account">
      <form onSubmit={submit} className="space-y-4">
        {(["fullName", "username", "email", "password"] as const).map((k) => (
          <div key={k} className="space-y-1.5">
            <Label htmlFor={k}>{k === "fullName" ? "Full name" : k[0].toUpperCase() + k.slice(1)}</Label>
            <Input id={k} required type={k === "password" ? "password" : k === "email" ? "email" : "text"} value={f[k]} onChange={set(k)} />
          </div>
        ))}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full">Register</Button>
        <p className="text-center text-sm text-muted-foreground">
          Have an account? <Link to="/login" className="underline">Sign in</Link>
        </p>
      </form>
    </AuthCard>
  );
}
