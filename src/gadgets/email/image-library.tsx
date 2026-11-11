import { useCallback, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Check, Copy, ImagePlus, Images, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, toMessage } from "@/lib/utils";
import { localImageRefs } from "./image-refs";
import * as mm from "./mdmailer";
import { t, useT } from "@/i18n";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
const fileLabel = (path: string) => path.replace(/^assets\//, "");

function Thumb({ path, name }: { path: string; name: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    mm.workAssetUrl(path).then((u) => live && setSrc(u)).catch(() => {});
    return () => { live = false; };
  }, [path]);
  return src ? (
    <img src={src} alt={name} className="size-full object-cover" draggable={false} />
  ) : (
    <div className="grid size-full place-items-center text-muted-foreground"><Loader2 className="size-4 animate-spin" /></div>
  );
}

/**
 * The app's shared image library: every email draws on the same images. Import, click an image to copy its path
 * (paste it after `photo:` or into `![](…)`) and delete, with a warning when something still uses an image.
 */
export function ImageLibrary({
  doc,
  savedDocs,
}: {
  /** The email being edited. */
  doc: string;
  /** Documents of the saved templates, so deleting an image they use can be flagged. */
  savedDocs: string[];
}) {
  const tr = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [images, setImages] = useState<mm.LibraryImage[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const usedHere = useMemo(() => new Set(localImageRefs(doc)), [doc]);
  const usedByTemplates = useMemo(() => new Set(savedDocs.flatMap(localImageRefs)), [savedDocs]);

  const refresh = useCallback(async () => {
    try {
      setImages(await mm.listLibrary());
    } catch (e) {
      toast.error(toMessage(e));
      setImages([]);
    }
  }, []);

  useEffect(() => {
    if (isOpen) void refresh();
    else setConfirmDelete(null);
  }, [isOpen, refresh]);

  async function importPicked() {
    try {
      const picked = await open({ multiple: true, filters: [{ name: "Images", extensions: IMAGE_EXTS }] });
      if (!picked) return;
      for (const p of Array.isArray(picked) ? picked : [picked]) await mm.importWorkAsset(p);
      await refresh();
    } catch (e) {
      toast.error(toMessage(e));
    }
  }

  async function importFiles(files: File[]) {
    try {
      for (const f of files.filter((f) => f.type.startsWith("image/"))) {
        await mm.addToLibrary(new Uint8Array(await f.arrayBuffer()), f.type, f.name);
      }
      await refresh();
    } catch (e) {
      toast.error(toMessage(e));
    }
  }

  async function copyPath(path: string) {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(path);
      setTimeout(() => setCopied((c) => (c === path ? null : c)), 1800);
    } catch {
      toast.error(t("email.images.copyFailed"));
    }
  }

  async function remove(img: mm.LibraryImage) {
    try {
      await mm.removeLibraryImage(img.path);
      setConfirmDelete(null);
      await refresh();
    } catch (e) {
      toast.error(toMessage(e));
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger render={<DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={tr("email.images.title")} />} />}>
          <Images />
        </TooltipTrigger>
        <TooltipContent>{tr("email.images.title")}</TooltipContent>
      </Tooltip>
      <DialogContent
        className={cn("flex max-h-[85vh] flex-col gap-4 sm:max-w-2xl", dragging && "ring-2 ring-ring")}
        onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
        onDrop={(e) => {
          setDragging(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length) { e.preventDefault(); void importFiles(files); }
        }}
      >
        <DialogHeader>
          <DialogTitle>{tr("email.images.title")}</DialogTitle>
          <DialogDescription>
            {tr("email.images.desc")}
            <code className="mx-1">photo:</code> {tr("email.images.desc2")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void importPicked()}><ImagePlus /> {tr("email.images.import")}</Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {images === null ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" /> {tr("common.loading")}
            </div>
          ) : images.length === 0 ? (
            <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              {tr("email.images.empty")}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((img) => {
                const here = usedHere.has(img.path);
                const elsewhere = usedByTemplates.has(img.path);
                const confirming = confirmDelete === img.path;
                return (
                  <li key={img.path} className="group flex flex-col overflow-hidden rounded-lg border bg-card">
                    <button
                      type="button"
                      className="relative aspect-square bg-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title={tr("email.images.clickCopy")}
                      onClick={() => void copyPath(img.path)}
                    >
                      <Thumb path={img.path} name={img.name} />
                      {here && <Badge className="absolute left-1.5 top-1.5" variant="secondary"><Check /> {tr("email.images.inThis")}</Badge>}
                    </button>
                    <div className="flex flex-col gap-1.5 p-2">
                      <p className="truncate text-xs font-medium" title={img.path}>{img.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground" title={img.path}>{fileLabel(img.path)}</p>
                      {confirming ? (
                        <div className="space-y-1.5">
                          <p className="text-[11px] text-amber-600 dark:text-amber-400">
                            {here && elsewhere ? tr("email.images.usedBoth") : here ? tr("email.images.usedHere") : elsewhere ? tr("email.images.usedTpl") : tr("email.images.deleteQ")}
                          </p>
                          <div className="flex gap-1.5">
                            <Button size="xs" variant="destructive" className="flex-1" onClick={() => void remove(img)}>{tr("common.delete")}</Button>
                            <Button size="icon-xs" variant="ghost" aria-label={tr("common.cancel")} onClick={() => setConfirmDelete(null)}><X /></Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-1.5">
                          <Button size="xs" variant="outline" className="flex-1" onClick={() => void copyPath(img.path)}>
                            {copied === img.path ? <><Check /> {tr("email.images.copied")}</> : <><Copy /> {tr("email.images.copyPath")}</>}
                          </Button>
                          <Button size="icon-xs" variant="ghost" aria-label={tr("email.images.deleteAria", { name: img.name })} title={tr("common.delete")} onClick={() => setConfirmDelete(img.path)}>
                            <Trash2 />
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
