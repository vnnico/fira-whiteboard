import { useAuth } from "../../hooks/useAuth";

export default function Topbar() {
  const { user } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-3">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Create</h1>
        <p className="text-xs text-slate-500">Whiteboard Collection</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fira-primary text-xs font-semibold text-white">
          {user?.username?.[0]?.toUpperCase() ?? "U"}
        </div>
      </div>
    </header>
  );
}
