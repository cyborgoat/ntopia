import type { LucideIcon } from "lucide-react";
import { ListTodo, Mail } from "lucide-react";

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
    id: "todo",
    name: "Todo list",
    description: "A simple checklist stored locally on this device.",
    icon: ListTodo,
    to: "/gadgets/todo",
  },
];
