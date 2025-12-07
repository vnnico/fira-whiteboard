// whiteboard/constants.js

export const ToolTypes = {
  POINTER: "POINTER",
  HAND: "HAND", // pan canvas (nanti)
  PENCIL: "PENCIL",
  RECTANGLE: "RECTANGLE",
  LINE: "LINE",
  TEXT: "TEXT",
  ERASER: "ERASER", // sementara: clear board
};

export const ActionTypes = {
  NONE: "NONE",
  DRAWING: "DRAWING",
  MOVING: "MOVING",
  RESIZING: "RESIZING",
  WRITING: "WRITING",
};

export const CursorPosition = {
  OUTSIDE: "OUTSIDE",
  INSIDE: "INSIDE",
  TOP_LEFT: "TOP_LEFT",
  TOP_RIGHT: "TOP_RIGHT",
  BOTTOM_LEFT: "BOTTOM_LEFT",
  BOTTOM_RIGHT: "BOTTOM_RIGHT",
  LEFT: "LEFT",
  RIGHT: "RIGHT",
  TOP: "TOP",
  BOTTOM: "BOTTOM",
};
