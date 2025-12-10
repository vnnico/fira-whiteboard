import { useEffect, useCallback } from "react";
import { SHORTCUTS } from "../constant/constants";

export const useKeyboardShortcuts = (handleAction) => {
  const handleKeyDown = useCallback(
    (event) => {
      // Cek apakah user sedang fokus mengetik di input/textarea
      // Jika YA, hentikan fungsi. Jangan jalankan shortcut apa pun.
      const targetTag = event.target.tagName.toLowerCase();
      const isInput =
        targetTag === "input" ||
        targetTag === "textarea" ||
        event.target.isContentEditable;

      if (isInput) return;

      const key = event.key.toLowerCase();
      const isCtrlPressed = event.ctrlKey || event.metaKey;

      const match = SHORTCUTS.find((s) => {
        // Cek Key (huruf sama)
        const keyMatch = s.keys.includes(key);

        // Cek Modifier (Ctrl status harus sesuai config)
        // Jika config butuh Ctrl, maka isCtrlPressed harus true
        // Jika config TIDAK butuh Ctrl, maka isCtrlPressed harus false (biar gak bentrok sama Copy/Paste)
        const modifierMatch = s.ctrl ? isCtrlPressed : !isCtrlPressed;

        return keyMatch && modifierMatch;
      });

      if (match) {
        if (match.preventDefault) {
          event.preventDefault();
          event.stopPropagation();
        }
        handleAction(match.action);
      }
    },
    [handleAction]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
};
