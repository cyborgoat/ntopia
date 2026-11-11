import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "./date-picker";
import { parseTime } from "./dates";
import {
  parseTags,
  REMIND_OPTIONS,
  URGENCY_OPTIONS,
  type Remind,
  type TodoItem,
  type Urgency,
} from "./store";
import { useT, type MessageKey } from "@/i18n";

type Patch = Partial<Omit<TodoItem, "id" | "createdAt">>;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** Edits every field of a todo; remount per item (`key`) so the form starts from its values. */
export function TodoDialog({ todo, onSave, onClose }: { todo: TodoItem; onSave: (patch: Patch) => void; onClose: () => void }) {
  const tr = useT();
  const [title, setTitle] = useState(todo.title);
  const [dueDate, setDueDate] = useState(todo.dueDate ?? "");
  const [dueTime, setDueTime] = useState(todo.dueTime ?? "");
  const [remind, setRemind] = useState<Remind>(todo.remind ?? "none");
  const [flagged, setFlagged] = useState(!!todo.flagged);
  const [urgency, setUrgency] = useState<Urgency>(todo.urgency ?? "none");
  const [tags, setTags] = useState((todo.tags ?? []).join(", "));
  const [location, setLocation] = useState(todo.location ?? "");
  const [notes, setNotes] = useState(todo.notes ?? "");

  const parsedTime = dueTime.trim() ? parseTime(dueTime) : "";
  const timeInvalid = !!dueDate && parsedTime === null;

  const save = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim() || timeInvalid) return;
    onSave({
      title,
      dueDate: dueDate || undefined,
      dueTime: parsedTime || undefined,
      remind: dueDate ? remind : "none",
      flagged,
      urgency,
      tags: parseTags(tags),
      location,
      notes,
    });
    onClose();
  };

  return (
    <Dialog open disablePointerDismissal onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tr("todo.edit")}</DialogTitle></DialogHeader>
        <form noValidate onSubmit={save} className="space-y-3">
          <Field label={tr("todo.field.title")}><Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("todo.field.dueDate")}><DatePicker value={dueDate} onChange={setDueDate} /></Field>
            <Field label={tr("todo.field.time")}>
              <Input
                value={dueTime}
                disabled={!dueDate}
                inputMode="numeric"
                placeholder="15:30"
                aria-invalid={timeInvalid}
                onChange={(e) => setDueTime(e.target.value)}
                onBlur={() => parsedTime && setDueTime(parsedTime)}
              />
              {timeInvalid && <p className="text-xs text-destructive">{tr("todo.timeInvalid")}</p>}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("todo.field.urgency")}>
              <NativeSelect
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as Urgency)}
              >
                {URGENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label.includes(".") ? tr(o.label as MessageKey) : o.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label={tr("todo.field.flag")}>
              <button
                type="button"
                onClick={() => setFlagged((f) => !f)}
                aria-pressed={flagged}
                className={`flex h-8 w-full items-center justify-center gap-2 rounded-lg border text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ${
                  flagged
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "border-input bg-transparent text-muted-foreground dark:bg-input/30"
                }`}
              >
                <Flag className={`size-3.5 ${flagged ? "fill-current" : ""}`} />
                {flagged ? tr("todo.flagged") : tr("todo.notFlagged")}
              </button>
            </Field>
          </div>
          <Field label={tr("todo.field.tags")}>
            <Input
              value={tags}
              placeholder={tr("todo.tagsPlaceholder")}
              onChange={(e) => setTags(e.target.value)}
            />
          </Field>
          <Field label={tr("todo.field.reminder")}>
            <NativeSelect
              value={remind}
              disabled={!dueDate}
              onChange={(e) => setRemind(e.target.value as Remind)}
            >
              {REMIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{tr(o.label)}</option>)}
            </NativeSelect>
            {remind !== "none" && !parsedTime && <p className="text-xs text-muted-foreground">{tr("todo.reminderDefaultTime")}</p>}
          </Field>
          <Field label={tr("todo.field.location")}><Input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
          <Field label={tr("todo.field.notes")}><Textarea value={notes} rows={4} placeholder={tr("todo.notesPlaceholder")} onChange={(e) => setNotes(e.target.value)} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{tr("common.cancel")}</Button>
            <Button type="submit" disabled={!title.trim() || timeInvalid}>{tr("common.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
