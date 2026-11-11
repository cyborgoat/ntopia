import { ArrowBigUp, Eye, MessageSquare } from "lucide-react";
import { t, useT } from "@/i18n";

function Stat({ icon: Icon, label, count }: { icon: typeof Eye; label: string; count: number }) {
  return (
    <span className="flex items-center gap-1.5" title={label} aria-label={label}>
      <Icon className="size-3.5" aria-hidden />
      {count}
    </span>
  );
}

/** The counters on a list row's author line. Pass only the ones the item has: votes, comments, views. */
export function FeedStats({ score, comments, views }: { score?: number; comments?: number; views?: number }) {
  useT();
  return (
    <>
      {score !== undefined && <Stat icon={ArrowBigUp} count={score} label={t(score === 1 ? "stat.vote1" : "stat.voteN", { n: score })} />}
      {comments !== undefined && <Stat icon={MessageSquare} count={comments} label={t(comments === 1 ? "stat.comment1" : "stat.commentN", { n: comments })} />}
      {views !== undefined && <Stat icon={Eye} count={views} label={t(views === 1 ? "stat.view1" : "stat.viewN", { n: views })} />}
    </>
  );
}
