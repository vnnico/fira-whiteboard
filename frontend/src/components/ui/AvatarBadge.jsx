import { getAvatarColor, getInitials } from "../../utils/avatarUtils";

export default function AvatarBadge({
  userId,
  username,
  size = 36,
  showName = false,
  nameMaxWidth = 140,
}) {
  var color = getAvatarColor(userId);
  var initials = getInitials(username, userId);

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          background: color,
          color: "white",
          fontWeight: 800,
          fontSize: Math.max(10, Math.round(size * 0.35)),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          boxShadow: "0 0 0 2px white, 0 8px 24px rgba(0,0,0,0.12)",
          userSelect: "none",
        }}
        title={username || ""}
      >
        {initials}
      </div>

      {showName && (
        <div
          style={{
            maxWidth: nameMaxWidth,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 13,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          {username || "Unknown"}
        </div>
      )}
    </div>
  );
}
