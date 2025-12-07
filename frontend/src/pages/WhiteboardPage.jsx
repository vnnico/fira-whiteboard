import { useParams } from "react-router-dom";
import WhiteboardCanvas from "../components/whiteboard/WhiteboardCanvas";

export default function WhiteboardPage() {
  const { roomId } = useParams();

  if (!roomId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100">
        <p>Missing roomId</p>
      </div>
    );
  }

  return <WhiteboardCanvas roomId={roomId} />;
}
