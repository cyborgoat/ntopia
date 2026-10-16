import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { uploadImage } from "@/components/image-upload";
import { useAuth } from "@/lib/auth";
import { errorMessage, orbit } from "@/lib/orbit";
import { cn, toMessage } from "@/lib/utils";

/** Avatar picker for the settings page: preset catalogue, custom upload, and reset to the default. */
export function AvatarSettings() {
  const { user, setUser } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["avatars"],
    queryFn: async () => (await orbit.GET("/api/avatars")).data,
    staleTime: Infinity,
  });
  if (!user) return null;

  const presets = data?.items ?? [];
  const isPreset = presets.some((p) => p.url === user.avatarUrl);
  const isCustom = !isPreset;

  /** `null` restores the default avatar. */
  async function save(avatarUrl: string | null) {
    setBusy(true);
    try {
      const { data, error } = await orbit.PATCH("/api/auth/me", { body: { avatarUrl } });
      if (data) {
        setUser(data);
        toast.success("Avatar updated");
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
    <div className="space-y-4">
      <h2 className="text-sm font-medium">Avatar</h2>
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage src={user.avatarUrl} alt="" />
          <AvatarFallback>{user.fullName.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
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
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
              <Upload /> Upload image
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void save(null)}>
              <RotateCcw /> Use default
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{isCustom ? "Using a custom image." : "Pick a preset below or upload your own."}</p>
        </div>
      </div>

      {presets.length > 0 && (
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Avatar presets">
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
      )}
    </div>
  );
}
