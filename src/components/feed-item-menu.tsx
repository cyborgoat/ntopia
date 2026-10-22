import type { ReactNode } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { copyText } from "@/lib/utils";

/** Right-click menu shared by feed rows: Open, Copy, and (when `onDelete` is given) Delete. */
export function FeedItemMenu({
  children,
  onOpen,
  openLabel = "Open",
  copy,
  onDelete,
}: {
  children: ReactNode;
  onOpen: () => void;
  openLabel?: string;
  /** Text to copy; `label` names it in the menu ("Copy title") and the toast ("Title copied"). */
  copy: { text: string; label: string };
  onDelete?: () => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="block w-full">{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onOpen}>
          <ExternalLink /> {openLabel}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => copyText(copy.text, copy.label)}>
          <Copy /> Copy {copy.label.toLowerCase()}
        </ContextMenuItem>
        {onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 /> Delete
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Delete mutation that refreshes every list cached under `queryKey`. */
export function useDeleteMutation<V = string>(queryKey: QueryKey, remove: (value: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: remove,
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });
}
