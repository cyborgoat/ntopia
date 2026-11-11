import { cloneElement, isValidElement, useId, useState } from "react";
import { toMessage } from "@/lib/utils";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useT } from "@/i18n";

export function FormDialog({
  title,
  triggerLabel,
  onSubmit,
  children,
}: {
  title: string;
  triggerLabel: string;
  /** Throw to keep the dialog open and show the message. */
  onSubmit: () => Promise<void>;
  children: React.ReactNode;
}) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit();
      setOpen(false);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus /> {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {children}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? tr("feed.saving") : tr("common.save")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Labelled form control; a single child element gets the id the label points at. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  const control = isValidElement<{ id?: string }>(children)
    ? cloneElement(children, { id: children.props.id ?? id })
    : children;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={isValidElement<{ id?: string }>(children) ? (children.props.id ?? id) : undefined}>{label}</Label>
      {control}
    </div>
  );
}
