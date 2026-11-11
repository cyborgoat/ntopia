import type { LucideIcon } from "lucide-react";
import { Mail } from "lucide-react";
import type { MessageKey } from "@/i18n";

export type Gadget = {
  id: string;
  name: MessageKey;
  description: MessageKey;
  icon: LucideIcon;
  to: string;
  /** Only admins and superusers see and can open this gadget. */
  privileged?: boolean;
};

/** Add a gadget: create a route under routes/_app/gadgets.<id>.tsx and register it here. */
export const gadgets: Gadget[] = [
  {
    id: "email",
    name: "gadget.email.name",
    description: "gadget.email.description",
    icon: Mail,
    to: "/gadgets/email",
    privileged: true,
  },
];
