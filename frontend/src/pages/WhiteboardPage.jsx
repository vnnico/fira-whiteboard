import { useParams } from "react-router-dom";
import WhiteboardCanvas from "../components/whiteboard/WhiteboardCanvas";
import { useAuth } from "../hooks/useAuth";
import RoomLayout from "../components/layout/RoomLayout";
import { useCallback, useState } from "react";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

export default function WhiteboardPage() {
  const { roomId } = useParams();
  const { isAuthenticated, loading } = useAuth();

  const [title, setTitle] = useState("Untitled");
  const [roomMembers, setRoomMembers] = useState([]);
  const [kickUserFn, setKickUserFn] = useState(null);
  const [setUserRoleFn, setSetUserRoleFn] = useState(null);

  if (!roomId)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100">
        Missing roomId
      </div>
    );
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );

  if (!isAuthenticated) {
    return (
      <RoomLayout title="Login Required">
        <div className="relative h-full w-full">
          <div className="absolute inset-0 blur-sm pointer-events-none">
            <WhiteboardCanvas roomId={roomId} />
          </div>
        </div>
      </RoomLayout>
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
    >
      <WhiteboardCanvas
        roomId={roomId}
        onTitleChange={setTitle}
        onMembersChange={setRoomMembers}
        onWhiteboardApi={({ kickUser, setUserRole }) => {
          if (kickUser) setKickUserFn(() => kickUser);
          if (setUserRole) setSetUserRoleFn(() => setUserRole);
        }}
      />
    </RoomLayout>
  );
}
