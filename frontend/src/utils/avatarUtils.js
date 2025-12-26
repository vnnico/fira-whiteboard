const AVATAR_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#84cc16", // lime
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
];

export function hashToIndex(str, mod) {
  if (!str) return 0;
  var h = 0;
  for (var i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h % mod;
}

export function getAvatarColor(userId) {
  var idx = hashToIndex(String(userId || ""), AVATAR_COLORS.length);
  return AVATAR_COLORS[idx];
}

export function getInitials(username, userId) {
  var name = String(username || "").trim();
  if (name) {
    var parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return String(userId || "?")
    .slice(-2)
    .toUpperCase();
}
