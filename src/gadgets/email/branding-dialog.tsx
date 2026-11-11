import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { ImagePlus, Palette, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-dialog";
import * as mm from "@/gadgets/email/mdmailer";
import { useT } from "@/i18n";

function LogoPicker({ name, onPick, onReset }: { name: string; onPick: () => void; onReset?: () => void }) {
  const tr = useT();
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
        aria-label={tr("email.branding.change")}
        className="group relative flex h-14 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {url ? <img src={url} alt={tr("email.branding.logoPreview")} className="max-h-full max-w-full object-contain" /> : <ImagePlus className="size-5 text-muted-foreground" />}
        <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-background/80 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Upload className="size-3.5" /> {tr("email.branding.change2")}
        </span>
      </button>
      <div className="min-w-0 space-y-0.5 text-xs text-muted-foreground">
        <p>{tr("email.branding.logoHint")}</p>
        {onReset && <button type="button" onClick={onReset} className="underline underline-offset-2 hover:text-foreground">{tr("email.branding.useDefault")}</button>}
      </div>
    </div>
  );
}

export function Branding() {
  const tr = useT();
  const [b, setB] = useState<mm.Branding>(mm.DEFAULT_BRANDING);
  const [openDlg, setOpenDlg] = useState(false);
  useEffect(() => { if (openDlg) mm.loadBranding().then(setB); }, [openDlg]);
  const set = (k: keyof mm.Branding) => (e: React.ChangeEvent<HTMLInputElement>) => setB({ ...b, [k]: e.target.value });

  return (
    <Dialog open={openDlg} onOpenChange={setOpenDlg}>
      <Tooltip>
        <TooltipTrigger render={<DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={tr("email.branding.tip")} />} />}><Palette /></TooltipTrigger>
        <TooltipContent>{tr("email.branding.tip")}</TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{tr("email.branding.title")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label={tr("email.branding.org")}><Input value={b.organization} onChange={set("organization")} /></Field>
          <Field label={tr("email.branding.tagline")}><Input value={b.tagline} onChange={set("tagline")} /></Field>
          <Field label={tr("email.branding.footer")}><Input value={b.footerText} onChange={set("footerText")} /></Field>
          <Field label={tr("email.branding.logo")}>
            <LogoPicker
              name={b.logo}
              onPick={async () => {
                const f = await open({ filters: [{ name: "Image", extensions: ["svg", "png", "jpg", "jpeg"] }] });
                if (f && !Array.isArray(f)) setB({ ...b, logo: await mm.setLogo(f) });
              }}
              onReset={b.logo.startsWith("logo-custom") ? () => setB({ ...b, logo: mm.DEFAULT_BRANDING.logo }) : undefined}
            />
          </Field>
          <Button className="w-full" onClick={async () => { await mm.saveBranding(b); toast.success(tr("email.branding.saved")); setOpenDlg(false); }}>{tr("common.save")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
