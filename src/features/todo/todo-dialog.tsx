import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "./date-picker";
import { parseTime } from "./dates";
import { REMIND_OPTIONS, type Remind, type TodoItem } from "./store";

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
  const [title, setTitle] = useState(todo.title);
  const [dueDate, setDueDate] = useState(todo.dueDate ?? "");
  const [dueTime, setDueTime] = useState(todo.dueTime ?? "");
  const [remind, setRemind] = useState<Remind>(todo.remind ?? "none");
  const [location, setLocation] = useState(todo.location ?? "");
  const [notes, setNotes] = useState(todo.notes ?? "");

  const parsedTime = dueTime.trim() ? parseTime(dueTime) : "";
  const timeInvalid = !!dueDate && parsedTime === null;

  const save = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim() || timeInvalid) return;
    onSave({ title, dueDate: dueDate || undefined, dueTime: parsedTime || undefined, remind: dueDate ? remind : "none", location, notes });
    onClose();
  };

  return (
    <Dialog open disablePointerDismissal onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit task</DialogTitle></DialogHeader>
        <form noValidate onSubmit={save} className="space-y-3">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date"><DatePicker value={dueDate} onChange={setDueDate} /></Field>
            <Field label="Time (24h)">
              <Input
                value={dueTime}
                disabled={!dueDate}
                inputMode="numeric"
                placeholder="HH:mm, e.g. 15:30"
                aria-invalid={timeInvalid}
                onChange={(e) => setDueTime(e.target.value)}
                onBlur={() => parsedTime && setDueTime(parsedTime)}
              />
              {timeInvalid && <p className="text-xs text-destructive">Use 24-hour time, e.g. 09:00 or 15:30.</p>}
            </Field>
          </div>
          <Field label="Reminder">
            <select
              value={remind}
              disabled={!dueDate}
              onChange={(e) => setRemind(e.target.value as Remind)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
            >
              {REMIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {remind !== "none" && !parsedTime && <p className="text-xs text-muted-foreground">No time set: reminders count from 09:00.</p>}
          </Field>
          <Field label="Location"><Input value={location} placeholder="Where?" onChange={(e) => setLocation(e.target.value)} /></Field>
          <Field label="Notes"><Textarea value={notes} rows={4} placeholder="Details, links, context…" onChange={(e) => setNotes(e.target.value)} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!title.trim() || timeInvalid}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
