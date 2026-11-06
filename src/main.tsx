import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createHashHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { AuthProvider } from "@/lib/auth";
import { AuthDialogProvider } from "@/components/auth-dialog";
import { TODO_STORAGE_KEY } from "@/features/todo/store";
import { NOTES_DIR_KEY } from "@/gadgets/notebook/workdir";
import { HOME_SEEN_KEY } from "@/components/home-digest";
import { STORAGE_KEYS, resetOrbit } from "@/lib/orbit";
import { initStorage, setItem } from "@/lib/storage";
import "@mdxeditor/editor/style.css";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } },
});
const router = createRouter({ routeTree, history: createHashHistory() });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

initStorage([...STORAGE_KEYS, TODO_STORAGE_KEY, HOME_SEEN_KEY, NOTES_DIR_KEY]).then(() => {
  // Retired gadget data: the old in-app notes and the Links gadget.
  void setItem("gadget-notes", null);
  void setItem("gadget-links", null);
  // The client was built at import time, before storage loaded: rebuild it with the saved server URL.
  resetOrbit();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthDialogProvider>
            <RouterProvider router={router} />
          </AuthDialogProvider>
        </AuthProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
});
