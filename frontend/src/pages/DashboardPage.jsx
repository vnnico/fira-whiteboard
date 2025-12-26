import { useEffect, useRef, useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import WhiteboardCardSkeleton from "../components/dashboard/WhiteboardCardSkeleton";
import { useToast } from "../hooks/useToast";
import { createWhiteboard, getWhiteboards } from "../services/whiteboardApi";
import { useNavigate } from "react-router-dom";
import LoadingModal from "../components/ui/LoadingModal";
import { formatDateTime } from "../utils/formatDateTime";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [myBoards, setMyBoards] = useState([]);
  const [joinedBoards, setJoinedBoards] = useState([]);
  const [activeSection, setActiveSection] = useState("my");
  const [creating, setCreating] = useState(false);

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

  const handleEnterWhiteboard = (roomId) => {
    navigate(`/board/${roomId}`);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <LoadingModal open={creating} title="Creating Whiteboard..." />
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
                          <div className="text-slate-400">•••</div>
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
