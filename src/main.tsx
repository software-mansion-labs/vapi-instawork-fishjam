import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FishjamProvider } from "@fishjam-cloud/react-client";
import { App } from "./App";
import "./style.css";

const FISHJAM_ID = import.meta.env.VITE_FISHJAM_ID as string;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FishjamProvider fishjamId={FISHJAM_ID}>
      <App />
    </FishjamProvider>
  </StrictMode>,
);
