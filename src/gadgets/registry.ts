import type { LucideIcon } from "lucide-react";
import { Mail } from "lucide-react";

export type Gadget = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  to: string;
  /** Only admins and superusers see and can open this gadget. */
  privileged?: boolean;
};

/** Add a gadget: create a route under routes/_app/gadgets.<id>.tsx and register it here. */
export const gadgets: Gadget[] = [
  {
    id: "email",
    name: "Email composer",
    description: "Write Markdown and turn it into a branded HTML / EML / PNG email.",
    icon: Mail,
    to: "/gadgets/email",
    privileged: true,
  },
];
