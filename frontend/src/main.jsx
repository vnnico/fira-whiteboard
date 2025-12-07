import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./hooks/useToast";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  </BrowserRouter>
);
