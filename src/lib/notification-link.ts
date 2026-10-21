import { BookOpen, CalendarDays, Megaphone, MessagesSquare, Newspaper, Bell, type LucideIcon } from "lucide-react";

type Target = { icon: LucideIcon; open?: (id: string) => { to: string; params: Record<string, string> } };

const norm = (s: string) => s.toLowerCase().replace(/[-_\s]/g, "");

// Keys are normalised `resourceType` values (or the `type` prefix, e.g. "forum" from "forum.created").
const TARGETS: Record<string, Target> = {
  announcement: { icon: Megaphone, open: (id) => ({ to: "/announcements/$id", params: { id } }) },
  event: { icon: CalendarDays, open: (id) => ({ to: "/events/$id", params: { id } }) },
  news: { icon: Newspaper, open: (id) => ({ to: "/news/$id", params: { id } }) },
  blog: { icon: BookOpen, open: (id) => ({ to: "/blog/$id", params: { id } }) },
  blogpost: { icon: BookOpen, open: (id) => ({ to: "/blog/$id", params: { id } }) },
  forum: { icon: MessagesSquare, open: (id) => ({ to: "/discussions/$postId", params: { postId: id } }) },
  forumpost: { icon: MessagesSquare, open: (id) => ({ to: "/discussions/$postId", params: { postId: id } }) },
};

/** Icon and (when the source is a known resource) the route to open for a notification. */
export function notificationTarget(n: { type: string; resourceType: string; resourceId: string }) {
  const target = TARGETS[norm(n.resourceType)] ?? TARGETS[norm(n.type.split(".")[0])];
  return { icon: target?.icon ?? Bell, link: n.resourceId ? target?.open?.(n.resourceId) : undefined };
}
