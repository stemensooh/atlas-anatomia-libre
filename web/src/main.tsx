import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
// Antes de montar React: captura el evento de instalación, que puede llegar muy pronto.
import "./data/install";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
