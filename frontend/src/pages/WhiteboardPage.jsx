import { useLocation, useNavigate, useParams } from "react-router-dom";
import WhiteboardCanvas from "../components/whiteboard/WhiteboardCanvas";
import { useAuth } from "../hooks/useAuth";
import RoomLayout from "../components/layout/RoomLayout";
import { useState } from "react";
import Button from "../components/ui/Button";
import LoadingModal from "../components/ui/LoadingModal";
import { useEffect } from "react";
import { useRef } from "react";

export default function WhiteboardPage() {
  const { roomId } = useParams();
  const { isAuthenticated } = useAuth();

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

  // Timer
  // ...

  const navigate = useNavigate();
  const location = useLocation();

  // Avoid setting state after unmount (e.g., navigate away mid-request)
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  if (!roomId)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100">
        Missing roomId
      </div>
    );

  if (!isAuthenticated) {
    return (
      <div className="relative h-screen w-screen overflow-hidden">
        <div className="absolute inset-0 blur-sm brightness-80 pointer-events-none">
          <WhiteboardCanvas roomId={roomId} />
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
              onClick={() => {
                navigate("/login", { state: { from: location } });
              }}
              className="w-full"
            >
              Log In to Join
            </Button>
          </div>
        </div>
      </div>
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
    >
      <WhiteboardCanvas
        roomId={roomId}
        onTitleChange={setTitle}
        onMembersChange={setRoomMembers}
        onConnectionStateChange={setWbConnectionState}
        onWhiteboardApi={({ kickUser, setUserRole, exportPng }) => {
          if (kickUser) setKickUserFn(() => kickUser);
          if (setUserRole) setSetUserRoleFn(() => setUserRole);
          if (exportPng) setOnExportPngFn(() => exportPng);
        }}
      />
    </RoomLayout>
  );
}
