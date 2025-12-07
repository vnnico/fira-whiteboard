import React, { createContext, useContext, useState, useCallback } from "react";
import Toast from "../components/ui/Toast";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "info", duration = 2500) => {
    setToast({ message, type });
    if (duration) {
      setTimeout(() => setToast(null), duration);
    }
  }, []);

  const value = { showToast };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast toast={toast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
