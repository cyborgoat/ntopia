import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { Copy, Download, FilePlus, FileText, Palette, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/form-dialog";
import { isTauri } from "@/lib/storage";
import { patchDoc, splitDoc } from "@/gadgets/email/frontmatter";
import * as mm from "@/gadgets/email/mdmailer";

export const Route = createFileRoute("/_app/gadgets/email")({ component: EmailGadget });

const TYPES = ["news", "notification", "meeting", "event", "invitation", "webinar"];
const THEMES = ["classic", "navy-gold", "forest-cream"];
const EVENT_TYPES = ["meeting", "event", "invitation", "webinar"];
const BLANK_DRAFT = "---\ntitle: \"Untitled\"\ntype: news\nlang: en\n---\n\n## Hello\n\nWrite your message…\n";

function mdBasename(path: string) {
  return path.split(/[/\\]/).pop()!.replace(/\.md$/i, "");
}

function EmailGadget() {
  if (!isTauri()) {
    return <p className="text-sm text-muted-foreground">The email composer needs the desktop app (run with <code>pnpm tauri:dev</code>).</p>;
  }
  return <Composer />;
}

function Composer() {
  const [drafts, setDrafts] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [doc, setDoc] = useState("");
  const [saved, setSaved] = useState(true);
  const [html, setHtml] = useState("");
  const [pngUrl, setPngUrl] = useState<string>();
  const [tab, setTab] = useState<"html" | "png">("html");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [templates, setTemplates] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const versionRef = useRef(0);
  const pngUrlRef = useRef<string | undefined>(undefined);

  const clearPng = useCallback(() => {
    if (pngUrlRef.current) URL.revokeObjectURL(pngUrlRef.current);
    pngUrlRef.current = undefined;
    setPngUrl(undefined);
  }, []);

  const refreshList = useCallback(async () => setDrafts(await mm.listDrafts()), []);

  useEffect(() => {
    refreshList().catch((e) => setError(String(e)));
    mm.listTemplates().then(setTemplates).catch(() => {});
    return () => {
      void mm.stopPreview();
      if (pngUrlRef.current) URL.revokeObjectURL(pngUrlRef.current);
    };
  }, [refreshList]);

  const openDraft = async (name: string) => {
    // Read before setting `current` so the autosave effect cannot overwrite a new draft with stale `doc`.
    const text = await mm.readDraft(name);
    versionRef.current = 0;
    setPreviewUrl(null);
    clearPng();
    setHtml("");
    setError("");
    setDoc(text);
    setSaved(true);
    setCurrent(name);
  };

  // Start mdmailer preview for the selected draft.
  useEffect(() => {
    if (!current) {
      void mm.stopPreview();
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    mm.startPreview(current)
      .then(({ url }) => {
        if (!cancelled) {
          setPreviewUrl(url);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [current]);

  // Poll preview /state for live HTML.
  useEffect(() => {
    if (!previewUrl || !current) return;
    let stopped = false;
    const tick = async () => {
      try {
        const state = await mm.fetchPreviewState(previewUrl, versionRef.current);
        if (stopped) return;
        setBusy(state.updating);
        if (state.error) setError(state.error);
        else if (state.html !== undefined) {
          setHtml(state.html);
          versionRef.current = state.version;
          setError("");
          clearPng();
        } else if (!state.updating) {
          setError("");
        }
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : String(e));
      }
      if (!stopped) timer = setTimeout(tick, 500);
    };
    let timer = setTimeout(tick, 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [previewUrl, current, clearPng]);

  // Autosave on edit (debounced). Preview server picks up the file change.
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(async () => {
      try {
        await mm.writeDraft(current, doc);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }, 500);
    return () => clearTimeout(t);
  }, [doc, current]);

  // The PNG card is slower (headless Chrome), so it renders only when its tab is shown.
  useEffect(() => {
    if (tab !== "png" || !current || pngUrl || !saved || error) return;
    let cancelled = false;
    setBusy(true);
    mm.render(current, ["png"])
      .then((r) => {
        if (cancelled) {
          if (r.pngUrl) URL.revokeObjectURL(r.pngUrl);
          return;
        }
        if (pngUrlRef.current) URL.revokeObjectURL(pngUrlRef.current);
        pngUrlRef.current = r.pngUrl;
        setPngUrl(r.pngUrl);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, current, pngUrl, saved, error, html]);

  async function create(name: string, text: string) {
    try {
      const safe = name.trim().replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-") || "untitled";
      let final = safe, n = 2;
      while ((await mm.listDrafts()).includes(final)) final = `${safe}-${n++}`;
      await mm.writeDraft(final, text);
      await refreshList();
      await openDraft(final);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    }
  }

  async function importMd() {
    try {
      const f = await open({ filters: [{ name: "Markdown", extensions: ["md"] }] });
      if (!f || Array.isArray(f)) return;
      await create(mdBasename(f), await readTextFile(f));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    }
  }

  const fm = splitDoc(doc).data;
  const set = (k: string) => (v: string) => { setDoc(patchDoc(doc, { [k]: v })); setSaved(false); };
  const isEvent = EVENT_TYPES.includes(String(fm.type));

  async function exportOne(format: mm.Format) {
    if (!current) return;
    try {
      const r = await mm.render(current, [format]);
      const target = await save({ defaultPath: `${current}.${format}`, filters: [{ name: format.toUpperCase(), extensions: [format] }] });
      if (target) {
        await mm.exportTo(r.paths[format]!, target);
        toast.success(`Saved ${format.toUpperCase()}`);
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  async function exportAll() {
    if (!current) return;
    try {
      const dir = await open({ directory: true, title: "Export to folder" });
      if (!dir || Array.isArray(dir)) return;
      const r = await mm.render(current, ["html", "eml", "png"]);
      for (const f of ["html", "eml", "png"] as const) {
        await mm.exportTo(r.paths[f]!, await join(dir, `${current}.${f}`));
      }
      toast.success("Exported HTML, EML and PNG");
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  async function openInMail() {
    if (!current) return;
    try {
      const r = await mm.render(current, ["eml"]);
      await openPath(r.paths.eml!);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  const startFromTemplate = async (t: string) => {
    try {
      const text = await mm.readTemplate(t);
      await create(t.replace(/\./g, "-"), text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    }
  };

  const startActions = (
    <div className="flex flex-col items-stretch gap-2">
      <Button type="button" onClick={() => void create("untitled", BLANK_DRAFT)}><FilePlus /> New blank draft</Button>
      <Button type="button" variant="outline" onClick={() => void importMd()}>Import .md</Button>
      {templates.length > 0 && (
        <Select onValueChange={(t) => { if (typeof t === "string") void startFromTemplate(t); }}>
          <SelectTrigger className="w-full"><SelectValue placeholder="New from template…" /></SelectTrigger>
          <SelectContent>{templates.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      )}
    </div>
  );

  return (
    <div className="-m-8 flex h-screen">
      {/* Files */}
      <aside className="flex w-52 shrink-0 flex-col border-r">
        <div className="flex items-center justify-between p-3">
          <span className="text-sm font-medium">Drafts</span>
          <div className="flex gap-1">
            <Branding />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="New blank draft"
              onClick={() => void create("untitled", BLANK_DRAFT)}>
              <FilePlus />
            </Button>
          </div>
        </div>
        <div className="flex-1 space-y-0.5 overflow-auto px-2">
          {drafts.map((d) => (
            <div key={d} className={`group flex items-center rounded-md text-sm ${d === current ? "bg-accent" : "hover:bg-muted"}`}>
              <button className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left" onClick={() => openDraft(d)}>
                <FileText className="size-3.5 shrink-0" /><span className="truncate">{d}</span>
              </button>
              <button className="px-2 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100" aria-label={`Delete ${d}`}
                onClick={async () => {
                  await mm.deleteDraft(d);
                  if (d === current) {
                    setCurrent(null);
                    setDoc("");
                    setHtml("");
                    clearPng();
                    void mm.stopPreview();
                    setPreviewUrl(null);
                  }
                  refreshList();
                }}>
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          {drafts.length === 0 && <p className="px-2 text-xs text-muted-foreground">No drafts yet.</p>}
        </div>
        <div className="space-y-2 border-t p-3">
          <span className="text-xs text-muted-foreground">New from template</span>
          <Select onValueChange={(t) => { if (typeof t === "string") void startFromTemplate(t); }}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>{templates.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => void importMd()}>Import .md</Button>
        </div>
      </aside>

      {current ? (
        <>
          {/* Editor */}
          <section className="flex min-w-0 flex-1 flex-col border-r">
            <div className="grid grid-cols-3 gap-2 border-b p-3">
              <Select value={String(fm.type ?? "")} onValueChange={(v) => v && set("type")(v)}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={String(fm.lang ?? "en")} onValueChange={(v) => v && set("lang")(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="zh">中文</SelectItem></SelectContent>
              </Select>
              <Select value={String(fm.theme ?? "")} onValueChange={(v) => v && set("theme")(v)}>
                <SelectTrigger><SelectValue placeholder="Theme" /></SelectTrigger>
                <SelectContent>{THEMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
              <Input className="col-span-3" placeholder="Title / subject" value={String(fm.title ?? "")} onChange={(e) => set("title")(e.target.value)} />
              {isEvent && (
                <>
                  <Input placeholder="Event name" value={String(fm.eventName ?? "")} onChange={(e) => set("eventName")(e.target.value)} />
                  <Input placeholder="Date (2026-10-15)" value={String(fm.startsAt ?? "")} onChange={(e) => set("startsAt")(e.target.value)} />
                  <Input placeholder="Time" value={String(fm.time ?? "")} onChange={(e) => set("time")(e.target.value)} />
                  <Input placeholder="Location" value={String(fm.location ?? "")} onChange={(e) => set("location")(e.target.value)} />
                  <Input placeholder="Join URL" value={String(fm.joinUrl ?? "")} onChange={(e) => set("joinUrl")(e.target.value)} />
                  <Input placeholder="RSVP URL" value={String(fm.rsvpUrl ?? "")} onChange={(e) => set("rsvpUrl")(e.target.value)} />
                </>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto text-sm">
              <CodeMirror value={doc} extensions={[markdown()]} basicSetup={{ lineNumbers: false, foldGutter: false }}
                onChange={(v) => { setDoc(v); setSaved(false); }} height="100%" style={{ height: "100%" }} />
            </div>
            <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">{current}.md · {saved ? "Saved" : "Saving…"}</div>
          </section>

          {/* Preview + export */}
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-2 border-b p-3">
              <Tabs value={tab} onValueChange={(v) => setTab(v as "html" | "png")}>
                <TabsList><TabsTrigger value="html">Email</TabsTrigger><TabsTrigger value="png">PNG card</TabsTrigger></TabsList>
              </Tabs>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => exportOne("html")}><Download /> HTML</Button>
                <Button variant="outline" size="sm" onClick={() => exportOne("eml")}><Download /> EML</Button>
                <Button variant="outline" size="sm" onClick={() => exportOne("png")}><Download /> PNG</Button>
                <Button variant="ghost" size="icon-sm" aria-label="Copy HTML" disabled={!html} onClick={() => navigator.clipboard.writeText(html).then(() => toast.success("HTML copied"))}><Copy /></Button>
                <Button size="sm" onClick={openInMail}>Open in Mail</Button>
                <Button variant="ghost" size="sm" onClick={exportAll}>Export all</Button>
              </div>
            </div>
            <div className="relative flex-1 overflow-auto bg-muted/40">
              {busy && <span className="absolute right-3 top-2 z-10 text-xs text-muted-foreground">Rendering…</span>}
              {error && <pre className="m-3 whitespace-pre-wrap rounded-md border border-destructive/30 bg-background p-3 text-xs text-destructive">{error}</pre>}
              {tab === "html" && html && <iframe title="Email preview" sandbox="" srcDoc={html} className="h-full w-full bg-white" />}
              {tab === "png" && !error && pngUrl && <img src={pngUrl} alt="PNG card" className="mx-auto max-w-full p-4" />}
              {tab === "html" && !html && !busy && !error && (
                <p className="p-6 text-sm text-muted-foreground">Waiting for live preview…</p>
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <p className="text-sm text-muted-foreground">Select a draft, or start one below.</p>
          <div className="w-64">{startActions}</div>
          {error && (
            <pre className="max-w-md whitespace-pre-wrap rounded-md border border-destructive/30 bg-background p-3 text-xs text-destructive">{error}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function Branding() {
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary color"><Input type="color" value={b.primaryColor} onChange={set("primaryColor")} /></Field>
            <Field label="Default theme">
              <Select value={b.preset} onValueChange={(v) => v && setB({ ...b, preset: v as mm.Branding["preset"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{THEMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Tagline"><Input value={b.tagline} onChange={set("tagline")} /></Field>
          <Field label="Footer"><Input value={b.footerText} onChange={set("footerText")} /></Field>
          <Field label="Logo">
            <Button variant="outline" size="sm" onClick={async () => {
              const f = await open({ filters: [{ name: "Image", extensions: ["svg", "png", "jpg", "jpeg"] }] });
              if (f && !Array.isArray(f)) setB({ ...b, logo: await mm.setLogo(f) });
            }}>{b.logo.startsWith("logo-custom") ? "Replace logo" : "Choose logo"}</Button>
          </Field>
          <Button className="w-full" onClick={async () => { await mm.saveBranding(b); toast.success("Branding saved"); setOpenDlg(false); }}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
