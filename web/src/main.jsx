import { AppContextProvider } from "./views/context/appContextProvider.jsx";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { initSounds } from "@utils";
import App from "./App.jsx";
import "./index.css";

initSounds();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppContextProvider>
      <App />
    </AppContextProvider>
  </StrictMode>,
);
