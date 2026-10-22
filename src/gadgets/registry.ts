import type { LucideIcon } from "lucide-react";
import { Bookmark, Mail, StickyNote, Timer } from "lucide-react";

export type Gadget = { id: string; name: string; description: string; icon: LucideIcon; to: string };

/** Add a gadget: create a route under routes/_app/gadgets.<id>.tsx and register it here. */
export const gadgets: Gadget[] = [
  {
    id: "email",
    name: "Email composer",
    description: "Write Markdown and turn it into a branded HTML / EML / PNG email.",
    icon: Mail,
    to: "/gadgets/email",
  },
  {
    id: "notes",
    name: "Notes",
    description: "Scratch Markdown notes stored on this device.",
    icon: StickyNote,
    to: "/gadgets/notes",
  },
  {
    id: "links",
    name: "Links",
    description: "Pin runbooks, dashboards, and portals you open often.",
    icon: Bookmark,
    to: "/gadgets/links",
  },
  {
    id: "timer",
    name: "Timer",
    description: "Focus and break countdowns.",
    icon: Timer,
    to: "/gadgets/timer",
  },
];
