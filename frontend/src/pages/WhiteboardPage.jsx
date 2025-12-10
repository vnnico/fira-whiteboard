import { useLocation, useNavigate, useParams } from "react-router-dom";
import WhiteboardCanvas from "../components/whiteboard/WhiteboardCanvas";
import { useAuth } from "../hooks/useAuth";
import Button from "../components/ui/Button";

export default function WhiteboardPage() {
  const { roomId } = useParams();
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!roomId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100">
        <p>Missing roomId</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="relative h-screen w-screen overflow-hidden">
        {/* Layer Belakang: Canvas "Pura-pura" (Blurry) */}
        {/* Kita render WhiteboardCanvas tapi user ga bisa interaksi */}
        <div className="absolute inset-0 blur-sm brightness-80 pointer-events-none">
          {/* Karena belum login, socket tidak akan connect (aman), 
               jadi canvas akan tampil kosong/putih dengan UI Shell. 
               Ini cukup untuk efek visual "background" */}
          <WhiteboardCanvas roomId={roomId} />
        </div>

        {/* Layer Depan: Modal Login */}
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

  return <WhiteboardCanvas roomId={roomId} />;
}
