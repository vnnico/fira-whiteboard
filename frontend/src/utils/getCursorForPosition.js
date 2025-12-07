import { CursorPosition } from "../constant/constants";

export function getCursorForPosition(position) {
  switch (position) {
    case CursorPosition.TOP_LEFT:
    case CursorPosition.BOTTOM_RIGHT:
      return "nwse-resize";
    case CursorPosition.TOP_RIGHT:
    case CursorPosition.BOTTOM_LEFT:
      return "nesw-resize";
    case CursorPosition.LEFT:
    case CursorPosition.RIGHT:
      return "ew-resize";
    case CursorPosition.TOP:
    case CursorPosition.BOTTOM:
      return "ns-resize";
    case CursorPosition.INSIDE:
      return "move";
    default:
      return "crosshair";
  }
}
