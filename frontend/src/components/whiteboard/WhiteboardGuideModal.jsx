import { useEffect, useMemo, useState } from "react";
import Button from "../ui/Button";

import {
  FiChevronLeft,
  FiDownload,
  FiHelpCircle,
  FiMenu,
  FiMessageSquare,
  FiMic,
  FiHeadphones,
  FiPhone,
  FiShare2,
  FiEdit2,
  FiUserMinus,
} from "react-icons/fi";

import {
  LuCircle,
  LuEraser,
  LuHand,
  LuPencil,
  LuSlash,
  LuSquare,
  LuText,
  LuTimer,
  LuTriangle,
  LuZoomIn,
  LuZoomOut,
} from "react-icons/lu";

import { FaRegCopy } from "react-icons/fa6";
import { GrDuplicate } from "react-icons/gr";
import { RiDeleteBin6Line } from "react-icons/ri";
import { onboarding } from "../../services/userApi";

function IconPill({ children, className = "" }) {
  return (
    <span
      className={[
        "inline-flex h-7 w-7 items-center justify-center rounded-lg",
        "bg-slate-100 text-slate-700 ring-1 ring-slate-900/5",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function ShortcutPill({ children }) {
  return (
    <span className="ml-2 inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-900/5">
      {children}
    </span>
  );
}

function RolePill({ children, className = "" }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function GuideRow({ icon, title, desc, shortcut, rightTag }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-3">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          {shortcut ? <ShortcutPill>{shortcut}</ShortcutPill> : null}
          {rightTag ? rightTag : null}
        </div>
        {desc ? (
          <div className="mt-1 text-xs text-slate-600">{desc}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function WhiteboardGuideModal({ open, onClose, onFinish }) {
  const pages = useMemo(
    () => [
      {
        title: "Quick Whiteboard Guide",
        content: (
          <div className="space-y-3">
            <div className="text-sm text-slate-600">
              This app supports real-time collaboration for drawing, writing,
              voice calls, and chat. Use this guide to get productive quickly.
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">
                Roles & permissions
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>
                  <b>Owner</b>: can change participant roles, remove (kick)
                  participants, and control the session timer.
                </li>
                <li>
                  <b>Editor</b>: can create and edit elements on the canvas.
                </li>
                <li>
                  <b>Viewer</b>: view-only (read-only).
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-3 text-xs text-slate-600">
              You can open this guide anytime using the <b>Guide</b> button in
              the header.
            </div>
          </div>
        ),
      },

      {
        title: "Canvas Navigation (Pan & Zoom)",
        content: (
          <div className="space-y-3">
            <GuideRow
              icon={
                <IconPill>
                  <LuHand className="h-4 w-4" />
                </IconPill>
              }
              title="Hand (Pan)"
              shortcut="H"
              desc="Move around the canvas without changing tools."
            />

            <GuideRow
              icon={
                <IconPill className="text-[12px] font-extrabold">🖱</IconPill>
              }
              title="Scroll (Vertical)"
              desc="Scroll up/down to move the view vertically."
            />

            <GuideRow
              icon={
                <IconPill className="text-[12px] font-extrabold">⇧</IconPill>
              }
              title="Shift + Scroll (Horizontal)"
              desc="Hold Shift while scrolling to move left/right."
            />

            <GuideRow
              icon={
                <IconPill>
                  <LuZoomIn className="h-4 w-4" />
                </IconPill>
              }
              title="Zoom In"
              shortcut="Ctrl/⌘ +"
              desc="Zoom in using the right-side control or keyboard shortcut."
            />

            <GuideRow
              icon={
                <IconPill>
                  <LuZoomOut className="h-4 w-4" />
                </IconPill>
              }
              title="Zoom Out"
              shortcut="Ctrl/⌘ -"
              desc="Zoom out using the right-side control or keyboard shortcut."
            />

            <GuideRow
              icon={
                <IconPill className="text-[12px] font-extrabold">100%</IconPill>
              }
              title="Reset View"
              desc="Click the zoom percentage (e.g., “100%”) to reset the view."
            />
          </div>
        ),
      },

      {
        title: "Whiteboard Tools",
        content: (
          <div className="space-y-3">
            <div className="grid gap-2">
              <GuideRow
                icon={
                  <IconPill className="text-[14px] font-extrabold">▲</IconPill>
                }
                title="Pointer / Select"
                shortcut="V"
                desc="Select, move, and resize elements."
              />

              <GuideRow
                icon={
                  <IconPill>
                    <LuHand className="h-4 w-4" />
                  </IconPill>
                }
                title="Hand"
                shortcut="H"
                desc="Navigation mode (pan)."
              />

              <GuideRow
                icon={
                  <IconPill>
                    <LuPencil className="h-4 w-4" />
                  </IconPill>
                }
                title="Pencil / Freehand"
                shortcut="P"
                desc="Freehand drawing for quick sketches."
              />

              <GuideRow
                icon={
                  <IconPill>
                    <LuEraser className="h-4 w-4" />
                  </IconPill>
                }
                title="Eraser"
                shortcut="E"
                desc="Recommended for erasing freehand (pencil) strokes."
              />

              <GuideRow
                icon={
                  <IconPill>
                    <LuSquare className="h-4 w-4" />
                  </IconPill>
                }
                title="Shapes"
                desc={
                  <span>
                    Rectangle (
                    <LuSquare className="inline h-4 w-4 align-text-bottom" />
                    ), Circle (
                    <LuCircle className="inline h-4 w-4 align-text-bottom" />
                    ), Triangle (
                    <LuTriangle className="inline h-4 w-4 align-text-bottom" />
                    ), Line (
                    <LuSlash className="inline h-4 w-4 align-text-bottom" />
                    ).
                  </span>
                }
              />

              <GuideRow
                icon={
                  <IconPill>
                    <LuText className="h-4 w-4" />
                  </IconPill>
                }
                title="Text"
                shortcut="T"
                desc="Add text labels/notes to the canvas."
              />
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
              <div className="font-semibold text-slate-700">Edit & delete</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  When an element is selected, the action bar appears:
                  <span className="ml-2 inline-flex items-center gap-2">
                    <IconPill className="h-6 w-6">
                      <FaRegCopy className="h-3.5 w-3.5" />
                    </IconPill>
                    <IconPill className="h-6 w-6">
                      <GrDuplicate className="h-3.5 w-3.5" />
                    </IconPill>
                    <IconPill className="h-6 w-6">
                      <RiDeleteBin6Line className="h-3.5 w-3.5" />
                    </IconPill>
                  </span>
                </li>
                <li>
                  Shortcuts: <b>Ctrl/⌘ C</b> (copy), <b>Ctrl/⌘ V</b> (paste),
                  <b> Ctrl/⌘ D</b> (duplicate), <b>Delete/Backspace</b> (delete
                  selected).
                </li>
                <li>
                  The <b>⌫</b> button on the toolbar behaves by context: if an
                  element is selected, it deletes the selected element; if
                  nothing is selected, it opens <b>Clear Whiteboard</b>.
                </li>
              </ul>
            </div>

            <div className="grid gap-2">
              <GuideRow
                icon={
                  <IconPill>
                    <span
                      className="h-4 w-4 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: "#111827" }}
                    />
                  </IconPill>
                }
                title="Stroke options"
                desc="Adjust stroke color, stroke width, and fill (for shapes)."
              />

              <GuideRow
                icon={
                  <IconPill>
                    <LuTimer className="h-4 w-4" />
                  </IconPill>
                }
                title="Timer"
                rightTag={<RolePill>Owner</RolePill>}
                desc="The Owner can start/stop the session timer. When the timer ends, the session ends and everyone is removed from the room."
              />

              <GuideRow
                icon={<IconPill>⌫</IconPill>}
                title="Clear Whiteboard"
                rightTag={<RolePill>Owner</RolePill>}
                desc="Clears the entire canvas. Restricted to Owner to reduce accidental destructive actions."
              />
            </div>
          </div>
        ),
      },

      {
        title: "Collaboration (Cursor & Lock)",
        content: (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-700">
              <div className="font-semibold">Prevent edit conflicts</div>
              <div className="mt-1 text-xs text-slate-600">
                When multiple users collaborate, elements may be temporarily
                locked to avoid conflicting edits.
              </div>
            </div>

            <div className="grid gap-2">
              <GuideRow
                icon={
                  <IconPill className="text-[12px] font-extrabold">⦿</IconPill>
                }
                title="Cursor presence"
                desc="See other participants’ cursors for better coordination."
              />

              <GuideRow
                icon={
                  <IconPill className="text-[12px] font-extrabold">⛓</IconPill>
                }
                title="Element lock (temporary)"
                desc="Locks are temporary and auto-release after a short duration or when the user loses focus/disconnects."
              />

              <GuideRow
                icon={
                  <IconPill>
                    <FiEdit2 className="h-4 w-4" />
                  </IconPill>
                }
                title="Change participant role"
                rightTag={<RolePill>Owner</RolePill>}
                desc="The Owner can change roles (Viewer/Editor) from the People sidebar."
              />

              <GuideRow
                icon={
                  <IconPill>
                    <FiUserMinus className="h-4 w-4" />
                  </IconPill>
                }
                title="Remove participant (kick)"
                rightTag={<RolePill>Owner</RolePill>}
                desc="The Owner can remove a participant from the room when needed."
              />
            </div>
          </div>
        ),
      },

      {
        title: "Voice, Chat, and Utilities",
        content: (
          <div className="space-y-3">
            <div className="grid gap-2">
              <GuideRow
                icon={
                  <IconPill>
                    <FiPhone className="h-4 w-4" />
                  </IconPill>
                }
                title="Join Voice"
                desc="Use the bottom dock to join the voice call."
              />

              <GuideRow
                icon={
                  <IconPill>
                    <FiMic className="h-4 w-4" />
                  </IconPill>
                }
                title="Mic on/off"
                desc="Toggle your microphone from the bottom dock."
              />

              <GuideRow
                icon={
                  <IconPill>
                    <FiHeadphones className="h-4 w-4" />
                  </IconPill>
                }
                title="Deafen"
                desc="Temporarily disable incoming audio."
              />

              <GuideRow
                icon={
                  <IconPill>
                    <FiMenu className="h-4 w-4" />
                  </IconPill>
                }
                title="Select microphone device"
                desc="Open the sidebar (Menu) and choose your microphone device. Use “Refresh device list” if needed."
              />

              <GuideRow
                icon={
                  <IconPill>
                    <FiMessageSquare className="h-4 w-4" />
                  </IconPill>
                }
                title="Chat"
                desc="Open chat from the dock or the sidebar. A badge indicates new messages."
              />
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">
                Header utilities
              </div>
              <div className="mt-2 grid gap-2">
                <GuideRow
                  icon={
                    <IconPill>
                      <FiDownload className="h-4 w-4" />
                    </IconPill>
                  }
                  title="Export PNG"
                  desc="Save the current whiteboard as an image."
                />

                <GuideRow
                  icon={
                    <IconPill>
                      <FiShare2 className="h-4 w-4" />
                    </IconPill>
                  }
                  title="Share"
                  desc="Copy and share the room link."
                />

                <GuideRow
                  icon={
                    <IconPill>
                      <FiHelpCircle className="h-4 w-4" />
                    </IconPill>
                  }
                  title="Guide"
                  desc="Open this guide anytime."
                />
              </div>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">
              Click <b>I Understand</b> to stop showing this guide
              automatically.
            </div>
          </div>
        ),
      },
    ],
    [],
  );

  const [step, setStep] = useState(0);

  // Friendly open/close animation (no external libs)
  const [mounted, setMounted] = useState(open);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => setAnimateIn(true));
    } else {
      setAnimateIn(false);
      const t = setTimeout(() => setMounted(false), 280);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!mounted) return null;

  const isFirst = step === 0;
  const isLast = step === pages.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Whiteboard guide"
    >
      <div
        className={[
          "absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]",
          "transition-opacity duration-300 ease-out",
          "motion-reduce:transition-none",
          animateIn ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={onClose}
      />

      <div
        className={[
          "relative w-[92%] max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-lg",
          "transition-all duration-300 ease-out",
          "motion-reduce:transition-none",
          animateIn
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-3 scale-[0.98]",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-800">
              {pages[step].title}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Step {step + 1} / {pages.length}
            </div>
          </div>

          <button
            className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            onClick={onClose}
            title="Close"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 max-h-[58vh] overflow-y-auto pr-1">
          {pages[step].content}
        </div>

        <div className="mt-6 flex items-center justify-between">
          {step > 0 && (
            <button
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={isFirst}
              type="button"
            >
              Back
            </button>
          )}

          {!isLast ? (
            <Button
              onClick={() => setStep((s) => Math.min(pages.length - 1, s + 1))}
              className="ms-auto"
            >
              Next
            </Button>
          ) : (
            <Button onClick={onFinish}>I Understand</Button>
          )}
        </div>
      </div>
    </div>
  );
}
