import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useT } from "@/i18n";

export type Confirm = { path: string; name: string; isDir: boolean } | null;

/** Confirmation before deleting a file or folder from disk. */
export function ConfirmDialog({ confirm, onCancel, onConfirm }: { confirm: Confirm; onCancel: () => void; onConfirm: () => void }) {
  const tr = useT();
  return (
    <AlertDialog open={!!confirm} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirm?.isDir ? tr("notebook.deleteFolderTitle") : tr("notebook.deleteFileTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {confirm?.isDir
              ? tr("notebook.deleteFolderBody", { name: confirm.name })
              : tr("notebook.deleteFileBody", { name: confirm?.name ?? "" })}{" "}
            {tr("notebook.cannotUndo")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tr("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>{tr("common.delete")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
