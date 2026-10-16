import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Upload } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { uploadImage } from "@/components/image-upload";
import { useAuth } from "@/lib/auth";
import { errorMessage, orbit } from "@/lib/orbit";
import { cn, toMessage } from "@/lib/utils";

/** Settings avatar: click it to pick a preset (the default preset restores the default) or upload an image. */
export function AvatarSettings() {
  const { user, setUser } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["avatars"],
    queryFn: async () => (await orbit.GET("/api/avatars")).data,
    staleTime: Infinity,
  });
  if (!user) return null;

  const presets = data?.items ?? [];

  /** `null` restores the default avatar. */
  async function save(avatarUrl: string | null) {
    setBusy(true);
    try {
      const { data, error } = await orbit.PATCH("/api/auth/me", { body: { avatarUrl } });
      if (data) {
        setUser(data);
        toast.success("Avatar updated");
        setOpen(false);
      } else toast.error(errorMessage(error));
    } catch (e) {
      toast.error(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setBusy(true);
    try {
      const url = await uploadImage(file);
      setBusy(false);
      await save(url);
    } catch (e) {
      setBusy(false);
      toast.error(toMessage(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label="Change avatar"
        className="group relative block size-16 shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="size-16">
          <AvatarImage src={user.avatarUrl} alt="" />
          <AvatarFallback className="text-lg">{user.fullName.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Pencil className="size-5" />
        </span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose your avatar</DialogTitle>
          <DialogDescription>Pick a preset or upload your own image.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-3" role="radiogroup" aria-label="Avatar presets">
          {presets.map((p) => {
            const selected = p.url === user.avatarUrl;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={p.name}
                title={p.name}
                disabled={busy}
                onClick={() => void save(p.isDefault ? null : p.url)}
                className={cn(
                  "overflow-hidden rounded-full border-2 border-transparent transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                  selected && "border-primary",
                )}
              >
                <img src={p.url} alt="" className="aspect-square w-full object-cover" />
              </button>
            );
          })}
        </div>

        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }}
        />
        <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
          <Upload /> Upload your own
        </Button>
      </DialogContent>
    </Dialog>
  );
}
