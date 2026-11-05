import { ArrowBigUp, Eye, MessageSquare } from "lucide-react";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Stat({ icon: Icon, label }: { icon: typeof Eye; label: string }) {
  const count = label.split(" ")[0];
  return (
    <span className="flex items-center gap-1.5" title={label} aria-label={label}>
      <Icon className="size-3.5" aria-hidden />
      {count}
    </span>
  );
}

/** The counters on a list row's author line. Pass only the ones the item has: votes, comments, views. */
export function FeedStats({ score, comments, views }: { score?: number; comments?: number; views?: number }) {
  return (
    <>
      {score !== undefined && <Stat icon={ArrowBigUp} label={plural(score, "vote")} />}
      {comments !== undefined && <Stat icon={MessageSquare} label={plural(comments, "comment")} />}
      {views !== undefined && <Stat icon={Eye} label={plural(views, "view")} />}
    </>
  );
}
