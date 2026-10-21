import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createHashHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { AuthProvider } from "@/lib/auth";
import { TODO_STORAGE_KEY } from "@/features/todo/store";
import { HOME_SEEN_KEY } from "@/components/home-digest";
import { STORAGE_KEYS } from "@/lib/orbit";
import { initStorage } from "@/lib/storage";
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

initStorage([...STORAGE_KEYS, TODO_STORAGE_KEY, HOME_SEEN_KEY]).then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
});
