import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import App from "@/App";
import { StoreProvider } from "@/store/store";
import { SessionProvider } from "@/store/session";
import { ToastProvider } from "@/components/ui/toast";

/** Renders one route to a string. Used by render.smoke.mjs. */
export function renderRoute(path) {
  return renderToString(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <StoreProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </StoreProvider>
      </SessionProvider>
    </MemoryRouter>
  );
}
