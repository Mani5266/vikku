import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "@/App";
import { StoreProvider } from "@/store/store";
import { SessionProvider } from "@/store/session";
import { ToastProvider } from "@/components/ui/toast";
import "./index.css";
// Fonts are bundled rather than fetched from a CDN: the hospital's network is not
// something to depend on, and a dashboard should not fall back to Arial on a bad day.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <StoreProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </StoreProvider>
      </SessionProvider>
    </BrowserRouter>
  </React.StrictMode>
);
