import AvatarBadge from "../ui/AvatarBadge";
import { getAvatarColor } from "../../utils/avatarUtils";

export default function CursorOverlay({ cursors }) {
  if (!cursors || cursors.length === 0) return null;

  return (
    <>
      {cursors.map((c) => {
        var color = getAvatarColor(c.userId);

        return (
          <div
            key={c.userId}
            className="pointer-events-none absolute"
            style={{
              left: c.x,
              top: c.y,
              transform: "translate(-2px, -2px)",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: color,
                boxShadow: "0 0 0 2px white",
              }}
            />
            <div style={{ marginTop: 6 }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.92)",
                  border: "1px solid rgba(0,0,0,0.06)",
                  borderRadius: 999,
                  padding: "4px 8px",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
                  display: "inline-block",
                }}
              >
                <AvatarBadge
                  userId={c.userId}
                  username={c.username}
                  size={22}
                  showName={true}
                  nameMaxWidth={120}
                />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
