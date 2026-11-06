import type { LucideIcon } from "lucide-react";
import { Mail, StickyNote, Timer } from "lucide-react";

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
    description: "Browse and edit text and images in a folder on this computer.",
    icon: StickyNote,
    to: "/gadgets/notes",
  },
  {
    id: "timer",
    name: "Timer",
    description: "Focus and break countdowns.",
    icon: Timer,
    to: "/gadgets/timer",
  },
];
