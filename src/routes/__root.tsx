import { Outlet, createRootRoute } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRoute({
  component: () => (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="ntopia-theme" disableTransitionOnChange>
      <Outlet />
      <Toaster position="bottom-right" />
    </ThemeProvider>
  ),
});
