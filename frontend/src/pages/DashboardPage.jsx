import React, { useEffect, useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import WhiteboardCardSkeleton from "../components/dashboard/WhiteboardCardSkeleton";
import { useToast } from "../hooks/useToast";
import { createWhiteboard, getWhiteboards } from "../services/whiteboardApi";
import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [whiteboards, setWhiteboards] = useState([]);
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    loadWhiteboards();
  }, []);

  const loadWhiteboards = async () => {
    try {
      const { whiteboards } = await getWhiteboards();
      setWhiteboards(whiteboards);
    } catch (err) {
      showToast("Failed to fetch whiteboads", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const { roomId } = await createWhiteboard();
      showToast("New whiteboard created", "success");
      navigate(`/board/${roomId}`);
    } catch (err) {
      showToast("Failed to create whiteboard", "error");
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />

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

          {/* Whiteboard collection */}
          <section>
            <h2 className="mb-4 text-sm font-semibold text-slate-600">
              Whiteboard Collection
            </h2>

            {loading ? (
              <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <WhiteboardCardSkeleton key={idx} />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {whiteboards.map((board) => (
                  <div
                    key={board.id}
                    className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
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
        </div>
      </main>
    </div>
  );
}
