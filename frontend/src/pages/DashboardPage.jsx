import { useEffect, useRef, useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import WhiteboardCardSkeleton from "../components/dashboard/WhiteboardCardSkeleton";
import { useToast } from "../hooks/useToast";
import {
  createWhiteboard,
  deleteWhiteboard,
  getWhiteboards,
  updateBoardTitle,
} from "../services/whiteboardApi";
import { useNavigate } from "react-router-dom";
import LoadingModal from "../components/ui/LoadingModal";
import { formatDateTime } from "../utils/formatDateTime";
import { FiEdit2, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [myBoards, setMyBoards] = useState([]);
  const [joinedBoards, setJoinedBoards] = useState([]);
  const [activeSection, setActiveSection] = useState("my");
  const [creating, setCreating] = useState(false);

  const [openMenuRoomId, setOpenMenuRoomId] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const navigate = useNavigate();
  const { showToast } = useToast();

  // Avoid setting state after unmount (e.g., navigate away mid-request)
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initially fetch and load list of my and joined whiteboards
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getWhiteboards();
        setMyBoards(data.myWhiteboards || []);
        setJoinedBoards(data.joinedWhiteboards || []);
      } catch (err) {
        showToast("Failed to load whiteboards", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [showToast]);

  useEffect(() => {
    if (!openMenuRoomId) return;

    const onClick = () => setOpenMenuRoomId(null);
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpenMenuRoomId(null);
    };

    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenuRoomId]);

  const handleCreate = async () => {
    // Prevent double submit
    if (creating) return;

    try {
      setCreating(true);
      const { roomId } = await createWhiteboard();
      showToast("New whiteboard created", "success");
      navigate(`/board/${roomId}`);
    } catch (err) {
      showToast("Failed to create whiteboard", "error");
      if (isMountedRef.current) setCreating(false);
    }
  };

  const submitRename = async () => {
    const nextTitle = renameValue.trim();
    if (!renameTarget) return;
    if (!nextTitle) {
      showToast("Title cannot be empty", "error");
      return;
    }

    try {
      setRenaming(true);
      await updateBoardTitle(renameTarget.roomId, nextTitle);

      setMyBoards((prev) =>
        prev.map((b) =>
          b.roomId === renameTarget.roomId ? { ...b, title: nextTitle } : b
        )
      );

      showToast("Whiteboard renamed", "success");
      setRenameTarget(null);
    } catch (err) {
      showToast("Failed to rename whiteboard", "error");
    } finally {
      setRenaming(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await deleteWhiteboard(deleteTarget.roomId);

      setMyBoards((prev) =>
        prev.filter((b) => b.roomId !== deleteTarget.roomId)
      );
      showToast("Whiteboard deleted", "success");
      setDeleteTarget(null);
    } catch (err) {
      showToast("Failed to delete whiteboard", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleEnterWhiteboard = (roomId) => {
    navigate(`/board/${roomId}`);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <LoadingModal open={creating} title="Creating Whiteboard..." />

      {/* Rename Modal */}
      {renameTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]"
            onClick={() => !renaming && setRenameTarget(null)}
          />
          <div
            className="relative w-[92%] max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-slate-800">
              Rename whiteboard
            </div>
            <div className="mt-4">
              <Input
                label="Title"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitRename();
                }}
                autoFocus
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                onClick={() => setRenameTarget(null)}
                disabled={renaming}
              >
                Cancel
              </button>
              <Button onClick={submitRename} disabled={renaming}>
                {renaming ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete Confirm Modal */}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div
            className="relative w-[92%] max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-slate-800">
              Delete whiteboard
            </div>
            <div className="mt-2 text-sm text-slate-600">
              This will permanently delete{" "}
              <span className="font-semibold">{deleteTarget.title}</span>.
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Sidebar
        activeSection={activeSection}
        onChangeSection={setActiveSection}
      />

      <main className="flex flex-1 flex-col">
        <Topbar />

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Create section */}
          <section className="mb-8">
            <button
              onClick={handleCreate}
              className="flex h-32 w-32 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-4xl font-light text-slate-400 shadow-sm hover:border-fira-primary hover:text-fira-primary"
            >
              +
            </button>
          </section>

          {activeSection === "my" ? (
            <section className="mb-10">
              <h2 className="mb-4 text-sm font-semibold text-slate-600">
                My Collection
              </h2>

              {loading ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <WhiteboardCardSkeleton key={idx} />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {myBoards &&
                    myBoards?.map((board) => (
                      <div
                        key={board.roomId}
                        className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        onClick={() => handleEnterWhiteboard(board.roomId)}
                      >
                        <div className="mb-4 h-24 rounded-xl bg-slate-100" />
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <div className="font-semibold text-slate-800">
                              {board.title}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {formatDateTime(board.createdAt)}
                            </div>
                          </div>
                          <div className="relative">
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                              aria-label="Whiteboard actions"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuRoomId((prev) =>
                                  prev === board.roomId ? null : board.roomId
                                );
                              }}
                            >
                              <FiMoreHorizontal className="h-5 w-5" />
                            </button>

                            {openMenuRoomId === board.roomId ? (
                              <div
                                className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuRoomId(null);
                                    setRenameTarget(board);
                                    setRenameValue(board.title || "");
                                  }}
                                >
                                  <FiEdit2 className="h-4 w-4 text-slate-500" />
                                  Rename
                                </button>

                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuRoomId(null);
                                    setDeleteTarget(board);
                                  }}
                                >
                                  <FiTrash2 className="h-4 w-4" />
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>
          ) : (
            <section className="mb-10">
              <h2 className="mb-4 text-sm font-semibold text-slate-600">
                Joined Whiteboards
              </h2>

              {loading ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <WhiteboardCardSkeleton key={idx} />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {joinedBoards &&
                    joinedBoards?.map((board) => (
                      <div
                        key={board.roomId}
                        className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        onClick={() => handleEnterWhiteboard(board.roomId)}
                      >
                        <div className="mb-4 h-24 rounded-xl bg-slate-100" />
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <div className="font-semibold text-slate-800">
                              {board.title}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {board.updatedAt}
                            </div>
                          </div>
                          <div className="text-slate-400">•••</div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
