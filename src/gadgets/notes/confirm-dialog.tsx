import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type Confirm = { path: string; name: string; isDir: boolean } | null;

/** Confirmation before deleting a file or folder from disk. */
export function ConfirmDialog({ confirm, onCancel, onConfirm }: { confirm: Confirm; onCancel: () => void; onConfirm: () => void }) {
  return (
    <AlertDialog open={!!confirm} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirm?.isDir ? "Delete folder?" : "Delete file?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {confirm?.isDir
              ? `“${confirm.name}” and everything inside it will be permanently deleted from disk.`
              : `“${confirm?.name}” will be permanently deleted from disk.`}{" "}
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
