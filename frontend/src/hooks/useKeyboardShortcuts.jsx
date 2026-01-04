import { useEffect, useRef } from "react";
import { SHORTCUTS } from "../constant/constants";

export const useKeyboardShortcuts = (handleAction) => {
  const actionRef = useRef(handleAction);

  useEffect(() => {
    actionRef.current = handleAction;
  }, [handleAction]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const targetTag = event.target.tagName.toLowerCase();
      const isInput =
        targetTag === "input" ||
        targetTag === "textarea" ||
        event.target.isContentEditable;
      if (isInput) return;

      const key = event.key.toLowerCase();
      const isCtrlPressed = event.ctrlKey || event.metaKey;

      const match = SHORTCUTS.find((s) => {
        const keyMatch = s.keys.includes(key);
        const modifierMatch = s.ctrl ? isCtrlPressed : !isCtrlPressed;
        return keyMatch && modifierMatch;
      });

      if (match) {
        if (match.preventDefault) {
          event.preventDefault();
          event.stopPropagation();
        }
        actionRef.current?.(match.action);
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
};
