import { useAuth } from "../../hooks/useAuth";
import AvatarBadge from "../ui/AvatarBadge";

export default function Topbar() {
  const { user } = useAuth();
  return (
    <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-3">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Create</h1>
        <p className="text-xs text-slate-500">Whiteboard Collection</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <div className="text-sm font-semibold text-slate-900 ">
            @{user?.username}
          </div>
          <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500 mt-[0.4]" />
            Online
          </div>
        </div>

        <AvatarBadge userId={user?.id} username={user?.username}></AvatarBadge>
      </div>
    </header>
  );
}
