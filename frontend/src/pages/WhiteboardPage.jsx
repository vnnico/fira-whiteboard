import { useLocation, useNavigate, useParams } from "react-router-dom";
import WhiteboardCanvas from "../components/whiteboard/WhiteboardCanvas";
import { useAuth } from "../hooks/useAuth";
import RoomLayout from "../components/layout/RoomLayout";
import { useState } from "react";
import Button from "../components/ui/Button";
import LoadingModal from "../components/ui/LoadingModal";
import { useEffect } from "react";
import { useRef } from "react";
import NotFoundPage from "./NotFoundPage";
import {
  checkWhiteboardExists,
  getWhiteboardMeta,
} from "../services/whiteboardApi";

export default function WhiteboardPage() {
  const { roomId } = useParams();
  const { isAuthenticated, loading } = useAuth();

  const [wbConnectionState, setWbConnectionState] = useState("disconnected");

  // Title
  const [title, setTitle] = useState("Untitled");

  // Room members list
  const [roomMembers, setRoomMembers] = useState([]);

  // Kick user functionality
  const [kickUserFn, setKickUserFn] = useState(null);

  // Modify role functionality
  const [setUserRoleFn, setSetUserRoleFn] = useState(null);

  // Export
  const [onExportPngFn, setOnExportPngFn] = useState(null);

  // Timer state + controls from WhiteboardCanvas
  const [timerState, setTimerState] = useState({
    running: false,
    endAt: null,
    durationMs: null,
    startedBy: null,
  });

  const [startTimerFn, setStartTimerFn] = useState(null);
  const [stopTimerFn, setStopTimerFn] = useState(null);
  const [resetTimerFn, setResetTimerFn] = useState(null);

  // idle | checking | ok | not_found | error
  const [boardStatus, setBoardStatus] = useState("idle");
  // null | true | false
  const [publicExists, setPublicExists] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  const isUuid = (value) => {
    const v = String(value || "");
    // UUID v1-v5
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    );
  };

  const isValidRoomId = !!roomId && isUuid(roomId);

  const Backdrop = () => (
    <div
      className="absolute inset-0"
      style={{
        backgroundColor: "#f8fafc",
        backgroundImage:
          "linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        backgroundPosition: "center",
      }}
    />
  );

  // if the server emits "wb-not-found" after socket connect.
  useEffect(() => {
    if (!isValidRoomId) return;

    const onNotFound = (e) => {
      const rid = String(e?.detail?.roomId || "");
      if (!rid || rid !== String(roomId)) return;
      setBoardStatus("not_found");
    };

    window.addEventListener("wb-not-found", onNotFound);
    return () => window.removeEventListener("wb-not-found", onNotFound);
  }, [isValidRoomId, roomId]);

  // Reset publicExists when user becomes unauthenticated (and when roomId changes).
  useEffect(() => {
    if (!isValidRoomId) return;
    if (!isAuthenticated) setPublicExists(null);
  }, [isValidRoomId, roomId, isAuthenticated]);

  // Public: check existence before showing login-required (anti "sneak peek").
  useEffect(() => {
    if (!isValidRoomId) return;
    if (loading) return;
    if (isAuthenticated) return;

    let cancelled = false;

    (async () => {
      try {
        const exists = await checkWhiteboardExists(roomId);
        if (!cancelled) setPublicExists(exists);
      } catch {
        if (!cancelled) setPublicExists(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isValidRoomId, loading, isAuthenticated, roomId]);

  // Private: fetch meta.
  useEffect(() => {
    if (!isValidRoomId) return;
    if (loading) return;
    if (!isAuthenticated) return;

    let cancelled = false;

    (async () => {
      try {
        setBoardStatus("checking");
        const meta = await getWhiteboardMeta(roomId);
        if (cancelled) return;

        if (meta?.title) setTitle(meta.title);
        setBoardStatus("ok");
      } catch (err) {
        if (cancelled) return;

        const code = err?.response?.status;
        if (code === 404) setBoardStatus("not_found");
        else setBoardStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isValidRoomId, loading, isAuthenticated, roomId]);

  // AFTER all hooks thn safe to return gated UI.
  if (!isValidRoomId) {
    if (!isAuthenticated) return <NotFoundPage />;
    return (
      <NotFoundPage
        title="Whiteboard not found"
        description="This whiteboard link is invalid. Please open a board from your dashboard."
      />
    );
  }

  if (!isAuthenticated) {
    if (loading || publicExists === null) {
      return (
        <div className="relative h-screen w-screen overflow-hidden">
          <Backdrop />
          <LoadingModal
            open={true}
            title="Opening..."
            subtitle="Checking link."
          />
        </div>
      );
    }

    if (publicExists === false) {
      return <NotFoundPage />;
    }

    return (
      <div className="relative h-screen w-screen overflow-hidden">
        <div className="absolute inset-0 blur-sm brightness-90 pointer-events-none">
          <Backdrop />
        </div>

        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl animate-[fadeIn_0.3s_ease-out]">
            <h2 className="mb-2 text-xl font-bold text-slate-900">
              Login Required
            </h2>
            <p className="mb-6 text-sm text-slate-500">
              You need to be logged in to join this whiteboard session.
            </p>

            <Button
              onClick={() => navigate("/login", { state: { from: location } })}
              className="w-full"
            >
              Log In to Join
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (boardStatus === "checking" || boardStatus === "idle") {
    return (
      <div className="relative h-screen w-screen overflow-hidden">
        <Backdrop />
        <LoadingModal
          open={true}
          title="Opening Whiteboard..."
          subtitle="Validating your board link."
        />
      </div>
    );
  }

  if (boardStatus === "not_found") {
    return (
      <NotFoundPage
        title="Whiteboard not found"
        description="This board does not exist or the link is no longer valid. Please open or create a board from your dashboard."
        primaryCta={{ label: "Back to Dashboard", to: "/" }}
      />
    );
  }

  if (boardStatus === "error") {
    return (
      <NotFoundPage
        title="Unable to open whiteboard"
        description="We could not validate this board right now. Please try again, or go back to the dashboard."
        primaryCta={{ label: "Back to Dashboard", to: "/" }}
      />
    );
  }
  return (
    <RoomLayout
      roomId={roomId}
      title={title}
      onTitleUpdated={setTitle}
      roomMembers={roomMembers}
      kickUserFn={kickUserFn}
      setUserRoleFn={setUserRoleFn}
      onExportPngFn={onExportPngFn}
      wbConnectionState={wbConnectionState}
      timerState={timerState}
      startTimerFn={startTimerFn}
      stopTimerFn={stopTimerFn}
      resetTimerFn={resetTimerFn}
    >
      <WhiteboardCanvas
        roomId={roomId}
        onTitleChange={setTitle}
        onMembersChange={setRoomMembers}
        onConnectionStateChange={setWbConnectionState}
        onWhiteboardApi={({
          kickUser,
          setUserRole,
          exportPng,
          timerState,
          startTimer,
          stopTimer,
          resetTimer,
        }) => {
          if (kickUser) setKickUserFn(() => kickUser);
          if (setUserRole) setSetUserRoleFn(() => setUserRole);
          if (exportPng) setOnExportPngFn(() => exportPng);
          if (timerState) setTimerState(timerState);
          if (startTimer) setStartTimerFn(() => startTimer);
          if (stopTimer) setStopTimerFn(() => stopTimer);
          if (resetTimer) setResetTimerFn(() => resetTimer);
        }}
      />
    </RoomLayout>
  );
}
