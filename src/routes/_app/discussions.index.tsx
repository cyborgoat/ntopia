import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowBigUp, Copy, ExternalLink, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { ImageUploadButton } from "@/components/image-upload";
import { Empty, PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { errorMessage, orbit } from "@/lib/orbit";

export const Route = createFileRoute("/_app/discussions/")({
  component: () => (
    <RequireAuth>
      <Discussions />
    </RequireAuth>
  ),
});

function threadUrl(id: string) {
  return `${window.location.origin}${window.location.pathname}#/discussions/${id}`;
}

function Discussions() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [f, setF] = useState({ title: "", content: "" });
  const { data } = useQuery({
    queryKey: ["forum-posts", q],
    queryFn: async () => (await orbit.GET("/forum-posts", { params: { query: { limit: 50, q: q || undefined } } })).data,
  });

  return (
    <>
      <PageHeader
        title="Discussions"
        description="Talk things through with the team."
        actions={
          <FormDialog
            title="Start a discussion"
            triggerLabel="New thread"
            onSubmit={async () => {
              const { error } = await orbit.POST("/forum-posts", { body: f });
              if (error) throw new Error(errorMessage(error));
              setF({ title: "", content: "" });
              qc.invalidateQueries({ queryKey: ["forum-posts"] });
            }}
          >
            <Field label="Title"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label="Message (Markdown)"><Textarea required rows={7} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} /></Field>
            <ImageUploadButton onUploaded={(u) => setF((p) => ({ ...p, content: `${p.content}\n\n![](${u})\n` }))} />
          </FormDialog>
        }
      />
      <Input placeholder="Search threads…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4" />
      <div className="divide-y rounded-lg border">
        {data?.items.length === 0 && <Empty>No threads yet. Start one!</Empty>}
        {data?.items.map((p) => (
          <ContextMenu key={p.id}>
            <ContextMenuTrigger className="block w-full">
              <Link to="/discussions/$postId" params={{ postId: p.id }} className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.title}</div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">{p.content}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{p.author.fullName} · {new Date(p.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><ArrowBigUp className="size-4" />{p.score}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="size-4" />{p.commentCount}</span>
                </div>
              </Link>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => void navigate({ to: "/discussions/$postId", params: { postId: p.id } })}>
                <ExternalLink /> Open thread
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => void navigator.clipboard.writeText(threadUrl(p.id)).then(() => toast.success("Link copied"))}>
                <Copy /> Copy link
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
    </>
  );
}
