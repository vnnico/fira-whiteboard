import { useCallback } from "react";
import { CursorPosition, ActionTypes } from "../constant/constants";

export function useElementSelection({
  selectedId,
  setSelectedId,
  setSelectedPosition,
  setAction,
  locks,
  myUserId,
  lockElement,
  unlockElement,
}) {
  const isLockedByOther = useCallback(
    (id) => !!(locks?.[id] && locks[id] !== myUserId),
    [locks, myUserId]
  );

  const unlockIfOwned = useCallback(
    (id) => {
      if (!id) return;
      if (locks?.[id] === myUserId) unlockElement(id);
    },
    [locks, myUserId, unlockElement]
  );

  const deselect = useCallback(() => {
    if (!selectedId) return;

    unlockIfOwned(selectedId);
    setSelectedId(null);
    setSelectedPosition(CursorPosition.OUTSIDE);
    setAction(ActionTypes.NONE);
    // unlockElement(selectedId);
    // setSelectedId(null);
    // setSelectedPosition(CursorPosition.OUTSIDE);
  }, [
    selectedId,
    unlockIfOwned,
    setSelectedId,
    setSelectedPosition,
    setAction,
  ]);

  /**
   * Select element (persist)
   * - unlock previous jika owned dan beda
   * - lock current jika tidak locked by other
   * return: { interactive: boolean }
   */
  const select = useCallback(
    (id, position) => {
      if (!id) return { interactive: false };

      // kalau switch selection, unlock yang lama (kalau milik kita)
      if (selectedId && selectedId !== id) unlockIfOwned(selectedId);

      // kalau dikunci user lain, kita boleh highlight tapi tidak interaktif
      if (isLockedByOther(id)) {
        setSelectedId(id);
        setSelectedPosition(position);
        setAction(ActionTypes.NONE);
        return { interactive: false };
      }

      // lock agar peer lihat "selected"
      if (locks?.[id] !== myUserId) lockElement(id);

      setSelectedId(id);
      setSelectedPosition(position);
      return { interactive: true };
    },
    [
      selectedId,
      unlockIfOwned,
      isLockedByOther,
      locks,
      myUserId,
      lockElement,
      setSelectedId,
      setSelectedPosition,
      setAction,
    ]
  );

  return { select, deselect, unlockIfOwned, isLockedByOther };
}
