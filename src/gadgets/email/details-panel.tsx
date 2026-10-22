import { useEffect, useRef, useState } from "react";
import YAML from "yaml";
import { open } from "@tauri-apps/plugin-dialog";
import { Code, ImagePlus, ListChecks, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn, toMessage } from "@/lib/utils";
import { stringifyMeta, type Frontmatter } from "./frontmatter";
import {
  EMAIL_LANGS, EMAIL_TYPES, THEME_PRESETS, isEventType, knownKeys, themeLabel, typeFields,
  type AgendaItem, type FieldDef, type Host,
} from "./fields";
import * as mm from "./mdmailer";

const DEFAULT_THEME = "__branding__";

const str = (v: unknown) => (v == null ? "" : String(v));

/** The email's frontmatter as a sectioned form, with a YAML escape hatch. */
export function DetailsPanel({ meta, onChange }: { meta: Frontmatter; onChange: (meta: Frontmatter) => void }) {
  const [yamlMode, setYamlMode] = useState(false);
  const type = str(meta.type) || "news";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <p className="text-xs text-muted-foreground">Header and event details</p>
        <div className="flex shrink-0 gap-1" role="group" aria-label="Edit mode">
          <Button size="sm" variant={yamlMode ? "ghost" : "secondary"} aria-pressed={!yamlMode} onClick={() => setYamlMode(false)}>
            <ListChecks /> Form
          </Button>
          <Button size="sm" variant={yamlMode ? "secondary" : "ghost"} aria-pressed={yamlMode} onClick={() => setYamlMode(true)}>
            <Code /> YAML
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-6">
        {yamlMode ? <YamlEditor value={meta} onChange={onChange} rows={24} /> : <DetailsForm meta={meta} type={type} onChange={onChange} />}
      </div>
    </div>
  );
}

function FieldRow({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1", wide && "col-span-2")}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function DetailsForm({ meta, type, onChange }: { meta: Frontmatter; type: string; onChange: (m: Frontmatter) => void }) {
  const set = (key: string, value: unknown) => onChange({ ...meta, [key]: value });
  const known = knownKeys(type);
  const other = Object.fromEntries(Object.entries(meta).filter(([k]) => !known.has(k)));
  const customTheme = typeof meta.theme === "object" && meta.theme != null;
  const typeInfo = EMAIL_TYPES.find((t) => t.value === type);

  return (
    <div className="space-y-6">
      <Section title="Basics" description="Subject and appearance.">
        <FieldRow label="Subject">
          <Input value={str(meta.title)} onChange={(e) => set("title", e.target.value)} />
        </FieldRow>
        <FieldRow label="Email type">
          <Select value={type} onValueChange={(v) => v && set("type", v)}>
            <SelectTrigger className="w-full"><SelectValue>{typeInfo?.label ?? type}</SelectValue></SelectTrigger>
            <SelectContent>
              {EMAIL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {typeInfo && <p className="text-xs text-muted-foreground">{typeInfo.description}</p>}
        </FieldRow>
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Language">
            <Select value={str(meta.lang) || "en"} onValueChange={(v) => v && set("lang", v)}>
              <SelectTrigger className="w-full"><SelectValue>{EMAIL_LANGS.find((l) => l.value === (str(meta.lang) || "en"))?.label}</SelectValue></SelectTrigger>
              <SelectContent>{EMAIL_LANGS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Theme">
            <Select
              value={customTheme ? "custom" : str(meta.theme) || DEFAULT_THEME}
              onValueChange={(v) => v && v !== "custom" && set("theme", v === DEFAULT_THEME ? undefined : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{customTheme ? "Custom" : meta.theme ? themeLabel(str(meta.theme)) : "Classic (default)"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_THEME}>Classic (default)</SelectItem>
                {THEME_PRESETS.map((t) => <SelectItem key={t} value={t}>{themeLabel(t)}</SelectItem>)}
                {customTheme && <SelectItem value="custom" disabled>Custom (edit in YAML)</SelectItem>}
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
      </Section>

      <Separator />

      <Section
        title={isEventType(type) ? "Event details" : type === "notification" ? "Notification" : "Content"}
        description={isEventType(type) ? "Shown in the event card at the top of the email." : type === "notification" ? "Shown as the banner and headline." : "Shown under the title."}
      >
        <div className="grid grid-cols-2 gap-3">
          {typeFields(type).map((f) => <TextField key={f.key} def={f} value={meta[f.key]} onChange={(v) => set(f.key, v)} />)}
        </div>
      </Section>

      {isEventType(type) && (
        <>
          <Separator />
          <Hosts value={Array.isArray(meta.hosts) ? (meta.hosts as Host[]) : []} onChange={(v) => set("hosts", v.length ? v : undefined)} />
          <Separator />
          <Agenda value={Array.isArray(meta.agenda) ? (meta.agenda as AgendaItem[]) : []} onChange={(v) => set("agenda", v.length ? v : undefined)} />
        </>
      )}

      {Object.keys(other).length > 0 && (
        <>
          <Separator />
          <Section title="Other fields" description="Additional frontmatter.">
            <YamlEditor
              value={other}
              rows={4}
              onChange={(next) => {
                const kept = Object.fromEntries(Object.entries(meta).filter(([k]) => known.has(k)));
                onChange({ ...kept, ...next });
              }}
            />
          </Section>
        </>
      )}
    </div>
  );
}

function TextField({ def, value, onChange }: { def: FieldDef; value: unknown; onChange: (v: string) => void }) {
  return (
    <FieldRow label={def.label} wide={def.wide}>
      <Input
        
        type={def.input ?? "text"}
        placeholder={def.placeholder}
        value={str(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldRow>
  );
}

function SectionHeader({ title, hint, onAdd, addLabel }: { title: string; hint: string; onAdd: () => void; addLabel: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
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
      <SectionHeader title="Hosts" hint="Shown as host cards with photo, role and bio." addLabel="Add host" onAdd={() => onChange([...value, { name: "" }])} />
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
            <Input  placeholder="Name" value={str(h.name)} onChange={(e) => onChange(update(value, i, { name: e.target.value }))} />
            <Input  placeholder="Role" value={str(h.role)} onChange={(e) => onChange(update(value, i, { role: e.target.value }))} />
            <Textarea
              className="col-span-2 min-h-0 text-sm"
              rows={2}
              placeholder="Brief biography"
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
      <SectionHeader title="Agenda" hint="Shown as a timeline below the event card." addLabel="Add item" onAdd={() => onChange([...value, { time: "", title: "" }])} />
      {value.map((a, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input className="w-24" placeholder="15:30" value={str(a.time)} onChange={(e) => onChange(update(value, i, { time: e.target.value }))} />
          <Input className="flex-1" placeholder="Agenda item" value={str(a.title)} onChange={(e) => onChange(update(value, i, { title: e.target.value }))} />
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
            setError(toMessage(err).split("\n")[0]);
          }
        }}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
