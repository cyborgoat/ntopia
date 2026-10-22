import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { ImagePlus, Palette, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-dialog";
import * as mm from "@/gadgets/email/mdmailer";

function LogoPicker({ name, onPick, onReset }: { name: string; onPick: () => void; onReset?: () => void }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let live = true;
    let made: string | undefined;
    setUrl(undefined);
    mm.logoBlobUrl(name).then((u) => {
      if (live) setUrl((made = u));
      else URL.revokeObjectURL(u);
    }).catch(() => {});
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [name]);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onPick}
        aria-label="Change logo"
        className="group relative flex h-14 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {url ? <img src={url} alt="Logo preview" className="max-h-full max-w-full object-contain" /> : <ImagePlus className="size-5 text-muted-foreground" />}
        <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-background/80 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Upload className="size-3.5" /> Change
        </span>
      </button>
      <div className="min-w-0 space-y-0.5 text-xs text-muted-foreground">
        <p>Shown in the email header. SVG, PNG or JPG.</p>
        {onReset && <button type="button" onClick={onReset} className="underline underline-offset-2 hover:text-foreground">Use default logo</button>}
      </div>
    </div>
  );
}

export function Branding() {
  const [b, setB] = useState<mm.Branding>(mm.DEFAULT_BRANDING);
  const [openDlg, setOpenDlg] = useState(false);
  useEffect(() => { if (openDlg) mm.loadBranding().then(setB); }, [openDlg]);
  const set = (k: keyof mm.Branding) => (e: React.ChangeEvent<HTMLInputElement>) => setB({ ...b, [k]: e.target.value });

  return (
    <Dialog open={openDlg} onOpenChange={setOpenDlg}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Branding" />}><Palette /></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Email branding</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Organization"><Input value={b.organization} onChange={set("organization")} /></Field>
          <Field label="Tagline"><Input value={b.tagline} onChange={set("tagline")} /></Field>
          <Field label="Footer"><Input value={b.footerText} onChange={set("footerText")} /></Field>
          <Field label="Logo">
            <LogoPicker
              name={b.logo}
              onPick={async () => {
                const f = await open({ filters: [{ name: "Image", extensions: ["svg", "png", "jpg", "jpeg"] }] });
                if (f && !Array.isArray(f)) setB({ ...b, logo: await mm.setLogo(f) });
              }}
              onReset={b.logo.startsWith("logo-custom") ? () => setB({ ...b, logo: mm.DEFAULT_BRANDING.logo }) : undefined}
            />
          </Field>
          <Button className="w-full" onClick={async () => { await mm.saveBranding(b); toast.success("Branding saved"); setOpenDlg(false); }}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
