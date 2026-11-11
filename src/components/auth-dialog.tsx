import { createContext, useContext, useState } from "react";
import { toMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { applyServerUrl, getServerUrl } from "@/lib/orbit";
import { useT } from "@/i18n";

type Mode = "login" | "register";

const AuthDialogContext = createContext<((mode?: Mode) => void) | null>(null);

/** Opens the sign-in / register dialog from anywhere under `AuthDialogProvider`. */
export function useAuthDialog() {
  const open = useContext(AuthDialogContext);
  if (!open) throw new Error("useAuthDialog outside AuthDialogProvider");
  return open;
}

export function AuthDialogProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode | null>(null);
  return (
    <AuthDialogContext.Provider value={(m = "login") => setMode(m)}>
      {children}
      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="max-w-sm">
          {/* Remount per mode so each form starts clean. */}
          {mode === "login" && <LoginForm key="login" onMode={setMode} onClose={() => setMode(null)} />}
          {mode === "register" && <RegisterForm key="register" onMode={setMode} />}
        </DialogContent>
      </Dialog>
    </AuthDialogContext.Provider>
  );
}

function Header({ title }: { title: string }) {
  return (
    <DialogHeader>
      <div className="text-xs font-semibold tracking-widest text-muted-foreground">NTOPIA</div>
      <DialogTitle>{title}</DialogTitle>
    </DialogHeader>
  );
}

function LoginForm({ onMode, onClose }: { onMode: (m: Mode) => void; onClose: () => void }) {
  const tr = useT();
  const { login } = useAuth();
  const [server, setServer] = useState(getServerUrl());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await applyServerUrl(server);
      await login(username, password);
      onClose();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header title={tr("auth.signIn")} />
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="server">{tr("auth.server")}</Label>
          <Input id="server" type="url" required placeholder="https://orbit.example.com" value={server} onChange={(e) => setServer(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">{tr("auth.usernameOrEmail")}</Label>
          <Input id="username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{tr("auth.password")}</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? tr("auth.signingIn") : tr("auth.signIn")}</Button>
        <p className="text-center text-sm text-muted-foreground">
          {tr("auth.noAccount")} <button type="button" className="underline" onClick={() => onMode("register")}>{tr("auth.register")}</button>
        </p>
      </form>
    </>
  );
}

function RegisterForm({ onMode }: { onMode: (m: Mode) => void }) {
  const tr = useT();
  const { register } = useAuth();
  const [f, setF] = useState({ username: "", fullName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await register({ ...f, email: f.email.trim() || null });
      setDone(true);
    } catch (err) {
      setError(toMessage(err));
    }
  }

  if (done)
    return (
      <>
        <Header title={tr("auth.requestReceived")} />
        <p className="text-sm text-muted-foreground">
          {tr("auth.pending")}
        </p>
        <Button variant="outline" className="w-full" onClick={() => onMode("login")}>{tr("auth.backToSignIn")}</Button>
      </>
    );

  return (
    <>
      <Header title={tr("auth.createAccount")} />
      <form onSubmit={submit} className="space-y-4">
        {(["fullName", "username", "email", "password"] as const).map((k) => (
          <div key={k} className="space-y-1.5">
            <Label htmlFor={k}>{k === "email" ? tr("auth.emailOptional") : tr(`auth.${k}` as "auth.fullName")}</Label>
            <Input id={k} required={k !== "email"} type={k === "password" ? "password" : k === "email" ? "email" : "text"} value={f[k]} onChange={set(k)} />
          </div>
        ))}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full">{tr("auth.register")}</Button>
        <p className="text-center text-sm text-muted-foreground">
          {tr("auth.haveAccount")} <button type="button" className="underline" onClick={() => onMode("login")}>{tr("auth.signIn")}</button>
        </p>
      </form>
    </>
  );
}
