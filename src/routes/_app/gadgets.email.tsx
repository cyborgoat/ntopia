import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
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
  const runId = useRef(0);

  const refreshList = useCallback(async () => setDrafts(await mm.listDrafts()), []);

  useEffect(() => {
    refreshList().catch((e) => setError(String(e)));
    mm.listTemplates().then(setTemplates).catch(() => {});
  }, [refreshList]);

  const openDraft = async (name: string) => {
    setCurrent(name);
    setDoc(await mm.readDraft(name));
    setSaved(true);
    setHtml("");
    setPngUrl(undefined);
  };

  // Autosave + re-render HTML on edit (debounced). Stale runs are discarded.
  useEffect(() => {
    if (!current) return;
    const id = ++runId.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        await mm.writeDraft(current, doc);
        setSaved(true);
        const r = await mm.render(current, ["html"]);
        if (id !== runId.current) return;
        setHtml(r.html ?? "");
        setError("");
        setPngUrl(undefined);
      } catch (e) {
        if (id === runId.current) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (id === runId.current) setBusy(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [doc, current]);

  // The PNG card is slower (headless Chrome), so it renders only when its tab is shown.
  useEffect(() => {
    if (tab !== "png" || !current || pngUrl || !saved || error) return;
    const id = runId.current;
    setBusy(true);
    mm.render(current, ["png"])
      .then((r) => id === runId.current && setPngUrl(r.pngUrl))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  }, [tab, current, pngUrl, saved, error, html]);

  async function create(name: string, text: string) {
    const safe = name.trim().replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-") || "untitled";
    let final = safe, n = 2;
    while ((await mm.listDrafts()).includes(final)) final = `${safe}-${n++}`;
    await mm.writeDraft(final, text);
    await refreshList();
    await openDraft(final);
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
      for (const f of ["html", "eml", "png"] as const) await mm.exportTo(r.paths[f]!, `${dir}/${current}.${f}`);
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

  return (
    <div className="-m-8 flex h-screen">
      {/* Files */}
      <aside className="flex w-52 shrink-0 flex-col border-r">
        <div className="flex items-center justify-between p-3">
          <span className="text-sm font-medium">Drafts</span>
          <div className="flex gap-1">
            <Branding />
            <Button variant="ghost" size="icon-sm" aria-label="New blank draft"
              onClick={() => create("untitled", "---\ntitle: \"Untitled\"\ntype: news\nlang: en\n---\n\n## Hello\n\nWrite your message…\n")}>
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
                onClick={async () => { await mm.deleteDraft(d); if (d === current) { setCurrent(null); setDoc(""); } refreshList(); }}>
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          {drafts.length === 0 && <p className="px-2 text-xs text-muted-foreground">No drafts yet.</p>}
        </div>
        <div className="space-y-2 border-t p-3">
          <span className="text-xs text-muted-foreground">New from template</span>
          <Select onValueChange={async (t) => { if (typeof t === "string") await create(t.replace(/\./g, "-"), await mm.readTemplate(t)); }}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>{templates.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="w-full" onClick={async () => {
            const f = await open({ filters: [{ name: "Markdown", extensions: ["md"] }] });
            if (f && !Array.isArray(f)) { create(f.split("/").pop()!.replace(/\.md$/, ""), await readTextFile(f)); }
          }}>Import .md</Button>
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
              {!error && tab === "html" && html && <iframe title="Email preview" sandbox="" srcDoc={html} className="h-full w-full bg-white" />}
              {!error && tab === "png" && pngUrl && <img src={pngUrl} alt="PNG card" className="mx-auto max-w-full p-4" />}
            </div>
          </section>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Select a draft, or start one from a template.
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
