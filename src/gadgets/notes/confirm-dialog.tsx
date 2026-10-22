import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type Confirm =
  | { kind: "empty-trash" }
  | { kind: "purge"; noteId: string; title: string }
  | { kind: "delete-folder"; folderId: string; name: string; noteCount: number }
  | null;

const plural = (n: number) => `${n} ${n === 1 ? "note" : "notes"}`;

/** Confirmation for the notes gadget's destructive actions. */
export function ConfirmDialog({
  confirm,
  trashedCount,
  onCancel,
  onConfirm,
}: {
  confirm: Confirm;
  trashedCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={!!confirm} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {confirm?.kind === "empty-trash" && "Empty trash?"}
            {confirm?.kind === "purge" && "Delete forever?"}
            {confirm?.kind === "delete-folder" && "Delete folder?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirm?.kind === "empty-trash" && `Permanently delete ${plural(trashedCount)}. This cannot be undone.`}
            {confirm?.kind === "purge" && `“${confirm.title}” will be permanently deleted. This cannot be undone.`}
            {confirm?.kind === "delete-folder" &&
              (confirm.noteCount > 0
                ? `Delete "${confirm.name}"? Its ${plural(confirm.noteCount)} will move to the top level.`
                : `Delete empty folder "${confirm.name}"?`)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant={confirm?.kind === "delete-folder" ? "default" : "destructive"} onClick={onConfirm}>
            {confirm?.kind === "empty-trash" && "Empty trash"}
            {confirm?.kind === "purge" && "Delete forever"}
            {confirm?.kind === "delete-folder" && "Delete folder"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
