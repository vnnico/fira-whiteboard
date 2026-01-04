// whiteboard/constants.js

export const ToolTypes = {
  POINTER: "POINTER",
  HAND: "HAND", // pan canvas (nanti)
  PENCIL: "PENCIL",
  RECTANGLE: "RECTANGLE",
  CIRCLE: "CIRCLE",
  TRIANGLE: "TRIANGLE",
  LINE: "LINE",
  TEXT: "TEXT",
  ERASER: "ERASER",
};

export const ActionTypes = {
  NONE: "NONE",
  DRAWING: "DRAWING",
  MOVING: "MOVING",
  RESIZING: "RESIZING",
  WRITING: "WRITING",
  ERASING: "ERASING",
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
  LINE_START: "LINE_START",
  LINE_END: "LINE_END",
};

export const SHORTCUTS = [
  {
    keys: ["v"],
    action: "TOOL_POINTER",
    ctrl: false,
    preventDefault: true,
  },
  {
    keys: ["h"],
    action: "TOOL_HAND",
    ctrl: false,
    preventDefault: true,
  },
  {
    keys: ["=", "+"],
    action: "ZOOM_IN",
    ctrl: true,
    preventDefault: true,
  },
  {
    keys: ["-"],
    action: "ZOOM_OUT",
    ctrl: true,
    preventDefault: true,
  },
  {
    keys: ["c"],
    action: "COPY",
    ctrl: true,
    preventDefault: true,
  },
  {
    keys: ["v"],
    action: "PASTE",
    ctrl: true,
    preventDefault: true,
  },
  {
    keys: ["d"],
    action: "DUPLICATE",
    ctrl: true,
    preventDefault: true,
  },
  {
    keys: ["delete", "backspace"],
    action: "DELETE_SELECTED",
    preventDefault: true,
  },
];
