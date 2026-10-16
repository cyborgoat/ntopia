import { useEffect, useRef, useState } from "react";
import YAML from "yaml";
import { open } from "@tauri-apps/plugin-dialog";
import { ChevronRight, Code, ImagePlus, ListChecks, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { stringifyMeta, type Frontmatter } from "./frontmatter";
import {
  EMAIL_LANGS, EMAIL_TYPES, THEME_PRESETS, isEventType, knownKeys, typeFields,
  type AgendaItem, type FieldDef, type Host,
} from "./fields";
import * as mm from "./mdmailer";

const OPEN_KEY = "ntopia.email-composer.details";
const DEFAULT_THEME = "__branding__";

const str = (v: unknown) => (v == null ? "" : String(v));

function loadOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Email frontmatter as a mail-style header: a one-line summary that expands into a form
 * (fields depend on `type`), with an "Edit as YAML" escape hatch.
 */
export function DetailsBar({ meta, onChange }: { meta: Frontmatter; onChange: (meta: Frontmatter) => void }) {
  const [expanded, setExpanded] = useState(loadOpen);
  const [yamlMode, setYamlMode] = useState(false);
  const type = str(meta.type) || "news";
  const theme = typeof meta.theme === "object" && meta.theme ? "custom" : str(meta.theme);
  const when = str(isEventType(type) ? meta.startsAt : meta.date);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    try {
      localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="border-b bg-muted/20">
      <div className="flex h-9 items-center gap-2 px-3">
        <button
          type="button"
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
          aria-expanded={expanded}
        >
          <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} />
          <span className="shrink-0 text-muted-foreground">Details</span>
          <span className="min-w-0 truncate font-medium">{str(meta.title) || "Untitled"}</span>
          <span className="ml-1 flex shrink-0 items-center gap-1">
            <Badge variant="secondary">{type}</Badge>
            {theme && <Badge variant="outline">{theme}</Badge>}
            {meta.lang != null && <Badge variant="outline">{str(meta.lang)}</Badge>}
            {when && <span className="text-xs text-muted-foreground">{when}</span>}
          </span>
        </button>
        {expanded && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setYamlMode((v) => !v)}>
            {yamlMode ? <><ListChecks /> Form</> : <><Code /> Edit as YAML</>}
          </Button>
        )}
      </div>
      {expanded && (
        <div className="max-h-[45vh] overflow-auto border-t px-3 py-3">
          {yamlMode ? <YamlEditor value={meta} onChange={onChange} /> : <DetailsForm meta={meta} type={type} onChange={onChange} />}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1", wide && "col-span-2")}>
      <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function DetailsForm({ meta, type, onChange }: { meta: Frontmatter; type: string; onChange: (m: Frontmatter) => void }) {
  const set = (key: string, value: unknown) => onChange({ ...meta, [key]: value });
  const known = knownKeys(type);
  const other = Object.fromEntries(Object.entries(meta).filter(([k]) => !known.has(k)));
  const customTheme = typeof meta.theme === "object" && meta.theme != null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <FieldRow label="Subject (title)" wide>
          <Input className="h-8" value={str(meta.title)} onChange={(e) => set("title", e.target.value)} />
        </FieldRow>
        <FieldRow label="Type">
          <Select value={type} onValueChange={(v) => v && set("type", v)}>
            <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{EMAIL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Language">
          <Select value={str(meta.lang) || "en"} onValueChange={(v) => v && set("lang", v)}>
            <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{EMAIL_LANGS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Theme">
          <Select
            value={customTheme ? "custom" : str(meta.theme) || DEFAULT_THEME}
            onValueChange={(v) => v && v !== "custom" && set("theme", v === DEFAULT_THEME ? undefined : v)}
          >
            <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_THEME}>Branding default</SelectItem>
              {THEME_PRESETS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              {customTheme && <SelectItem value="custom" disabled>custom (edit as YAML)</SelectItem>}
            </SelectContent>
          </Select>
        </FieldRow>
        {typeFields(type).map((f) => <TextField key={f.key} def={f} value={meta[f.key]} onChange={(v) => set(f.key, v)} />)}
      </div>

      {isEventType(type) && (
        <>
          <Hosts value={Array.isArray(meta.hosts) ? (meta.hosts as Host[]) : []} onChange={(v) => set("hosts", v.length ? v : undefined)} />
          <Agenda value={Array.isArray(meta.agenda) ? (meta.agenda as AgendaItem[]) : []} onChange={(v) => set("agenda", v.length ? v : undefined)} />
        </>
      )}

      {Object.keys(other).length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs font-normal text-muted-foreground">Other fields</Label>
          <YamlEditor
            value={other}
            rows={3}
            onChange={(next) => {
              const kept = Object.fromEntries(Object.entries(meta).filter(([k]) => known.has(k)));
              onChange({ ...kept, ...next });
            }}
          />
        </div>
      )}
    </div>
  );
}

function TextField({ def, value, onChange }: { def: FieldDef; value: unknown; onChange: (v: string) => void }) {
  return (
    <FieldRow label={def.label} wide={def.wide}>
      <Input
        className="h-8"
        type={def.input ?? "text"}
        placeholder={def.placeholder}
        value={str(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldRow>
  );
}

function SectionHeader({ title, onAdd, addLabel }: { title: string; onAdd: () => void; addLabel: string }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs font-normal text-muted-foreground">{title}</Label>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onAdd}><Plus /> {addLabel}</Button>
    </div>
  );
}

function update<T>(list: T[], i: number, patch: Partial<T>): T[] {
  return list.map((item, j) => (j === i ? { ...item, ...patch } : item));
}

function Hosts({ value, onChange }: { value: Host[]; onChange: (v: Host[]) => void }) {
  return (
    <div className="space-y-2">
      <SectionHeader title="Hosts" addLabel="Add host" onAdd={() => onChange([...value, { name: "" }])} />
      {value.map((h, i) => (
        <div key={i} className="flex gap-3 rounded-md border bg-background p-2">
          <HostPhoto
            src={h.photo}
            onPick={async () => {
              const f = await open({ filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }] });
              if (f && !Array.isArray(f)) onChange(update(value, i, { photo: await mm.importWorkAsset(f) }));
            }}
          />
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
            <Input className="h-8" placeholder="Name" value={str(h.name)} onChange={(e) => onChange(update(value, i, { name: e.target.value }))} />
            <Input className="h-8" placeholder="Role" value={str(h.role)} onChange={(e) => onChange(update(value, i, { role: e.target.value }))} />
            <Textarea
              className="col-span-2 min-h-0 text-sm"
              rows={2}
              placeholder="Short bio"
              value={str(h.bio)}
              onChange={(e) => onChange(update(value, i, { bio: e.target.value }))}
            />
          </div>
          <Button variant="ghost" size="icon-xs" aria-label="Remove host" onClick={() => onChange(value.filter((_, j) => j !== i))}><X /></Button>
        </div>
      ))}
    </div>
  );
}

function HostPhoto({ src, onPick }: { src?: string; onPick: () => void }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let live = true;
    setUrl(undefined);
    if (src) mm.workAssetUrl(src).then((u) => live && setUrl(u)).catch(() => {});
    return () => {
      live = false;
    };
  }, [src]);
  return (
    <button
      type="button"
      onClick={onPick}
      title={src ? "Change photo" : "Add photo"}
      className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-muted-foreground hover:opacity-80"
    >
      {url ? <img src={url} alt="" className="size-full object-cover" /> : <ImagePlus className="size-4" />}
    </button>
  );
}

function Agenda({ value, onChange }: { value: AgendaItem[]; onChange: (v: AgendaItem[]) => void }) {
  return (
    <div className="space-y-2">
      <SectionHeader title="Agenda" addLabel="Add item" onAdd={() => onChange([...value, { time: "", title: "" }])} />
      {value.map((a, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input className="h-8 w-24" placeholder="15:00" value={str(a.time)} onChange={(e) => onChange(update(value, i, { time: e.target.value }))} />
          <Input className="h-8 flex-1" placeholder="What happens" value={str(a.title)} onChange={(e) => onChange(update(value, i, { title: e.target.value }))} />
          <Button variant="ghost" size="icon-xs" aria-label="Remove item" onClick={() => onChange(value.filter((_, j) => j !== i))}><X /></Button>
        </div>
      ))}
    </div>
  );
}

/** YAML textarea that only emits when the text parses to a mapping; shows the parse error otherwise. */
function YamlEditor({ value, onChange, rows = 10 }: { value: Frontmatter; onChange: (v: Frontmatter) => void; rows?: number }) {
  const serialized = stringifyMeta(value);
  const [text, setText] = useState(serialized);
  const [error, setError] = useState("");
  const emitted = useRef(serialized);

  // Resync only when the value changes from outside (template load, form edits), not on our own echoes.
  useEffect(() => {
    if (serialized === emitted.current) return;
    emitted.current = serialized;
    setText(serialized);
    setError("");
  }, [serialized]);

  return (
    <div className="space-y-1">
      <Textarea
        rows={rows}
        spellCheck={false}
        className="font-mono text-xs"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = (YAML.parse(e.target.value) ?? {}) as unknown;
            if (typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected key: value pairs");
            setError("");
            emitted.current = stringifyMeta(parsed as Frontmatter);
            onChange(parsed as Frontmatter);
          } catch (err) {
            setError(err instanceof Error ? err.message.split("\n")[0] : String(err));
          }
        }}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
