import React, { useState } from "react";
import {
  FiGrid,
  FiLogOut,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { useAuth } from "../../hooks/useAuth";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();

  return (
    <aside
      className={`
        flex h-screen flex-col border-r border-slate-200 bg-slate-900 text-slate-100
        transition-all duration-200
        ${collapsed ? "w-14" : "w-64"}
      `}
    >
      <div className="flex items-center justify-between px-3 py-4">
        {!collapsed && (
          <span className="text-sm font-semibold tracking-wide">Fira</span>
        )}
        <button
          className="rounded-full bg-slate-800 p-1 text-xs"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2">
        <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-800">
          <FiGrid className="h-4 w-4" />
          {!collapsed && <span>My Whiteboards</span>}
        </button>
        {/* nanti bisa tambah menu shared, settings, dll */}
      </nav>

      <div className="border-t border-slate-800 px-3 py-3 text-xs">
        {!collapsed && (
          <div className="mb-2 text-slate-300">
            <div className="font-medium">{user?.displayName}</div>
            <div className="text-[11px] text-slate-400">@{user?.username}</div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-300 hover:bg-slate-800"
        >
          <FiLogOut className="h-3 w-3" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
