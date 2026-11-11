import type { User } from "./auth";

/** Admins and superusers have more privilege than regular users. */
export const isPrivileged = (user: Pick<User, "role"> | null | undefined) =>
  user?.role === "ADMIN" || user?.role === "SUPERUSER";
