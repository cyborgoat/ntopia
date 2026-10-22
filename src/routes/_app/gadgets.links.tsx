import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Field, FormDialog } from "@/components/form-dialog";
import { Empty, PageHeader } from "@/components/page-header";
import { addLink, deleteLink, listLinks, type ShelfLink } from "@/gadgets/links/store";
import { openExternal } from "@/lib/open-external";
import { toMessage, copyText } from "@/lib/utils";

export const Route = createFileRoute("/_app/gadgets/links")({ component: LinksGadget });

function LinksGadget() {
  const [links, setLinks] = useState<ShelfLink[]>(() => listLinks());
  const [f, setF] = useState({ title: "", url: "" });

  const open = async (url: string) => {
    try {
      await openExternal(url);
    } catch (e) {
      toast.error(toMessage(e));
    }
  };

  return (
    <>
      <PageHeader
        title="Links"
        actions={
          <FormDialog
            title="Add link"
            triggerLabel="Add"
            onSubmit={async () => {
              addLink(f);
              setF({ title: "", url: "" });
              setLinks(listLinks());
            }}
          >
            <Field label="Title (optional)"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label="URL"><Input required type="url" value={f.url} placeholder="https://example.com" onChange={(e) => setF({ ...f, url: e.target.value })} /></Field>
          </FormDialog>
        }
      />
      <div className="space-y-2">
        {links.length === 0 && <Empty>No links yet. Pin runbooks, dashboards, or portals you open often.</Empty>}
        {links.map((l) => (
          <ContextMenu key={l.id}>
            <ContextMenuTrigger className="block w-full">
              <div className="group relative flex items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors hover:bg-muted/50">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void open(l.url)}>
                  <p className="truncate text-sm font-semibold tracking-tight">{l.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{l.url}</p>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label="Open"
                  onClick={() => void open(l.url)}
                >
                  <ExternalLink />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label="Delete"
                  onClick={() => setLinks(deleteLink(l.id))}
                >
                  <Trash2 />
                </Button>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => void open(l.url)}><ExternalLink /> Open</ContextMenuItem>
              <ContextMenuItem onClick={() => copyText(l.url, "URL")}>
                <Copy /> Copy URL
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onClick={() => setLinks(deleteLink(l.id))}>
                <Trash2 /> Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
    </>
  );
}
