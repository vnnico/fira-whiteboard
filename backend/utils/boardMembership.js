import { Board, Roles } from "../models/whiteboardModel.js";

export const DEFAULT_ROLE_FOR_NEW_MEMBER = Roles.VIEWER;

export function isOwner(board, userId) {
  const uid = String(userId || "");
  if (!uid || !board) return false;

  return (
    (board.createdBy && String(board.createdBy) === uid) ||
    String(board.roles?.[uid] || "") === Roles.OWNER
  );
}

export function isBoardMember(board, userId) {
  const uid = String(userId || "");
  if (!uid || !board) return false;

  if (board.createdBy && String(board.createdBy) === uid) return true;

  const members = Array.isArray(board.members) ? board.members : [];
  if (members.some((m) => String(m) === uid)) return true;

  if (board.roles && typeof board.roles === "object") {
    if (typeof board.roles[uid] === "string") return true;
  }
  return false;
}

export async function ensureBoardExistsAndUpsertMember(
  roomId,
  userId,
  opts = {},
) {
  const rid = String(roomId || "");
  const uid = String(userId || "");
  if (!rid || !uid) return { ok: false, code: "bad-request" };

  const select =
    opts.select || "roomId createdBy members roles locked title updatedAt";
  const defaultRole = opts.defaultRole || DEFAULT_ROLE_FOR_NEW_MEMBER;

  const board = await Board.findOne({ roomId: rid }).select(select).lean();
  if (!board) return { ok: false, code: "board-not-found" };

  const owner = isOwner(board, uid);
  const hasRole = !!board.roles?.[uid];

  const update = {
    $addToSet: { members: uid },
    $set: { updatedAt: new Date() },
  };
  if (!owner && !hasRole) update.$set[`roles.${uid}`] = defaultRole;

  await Board.updateOne({ roomId: rid }, update);

  const role = owner ? Roles.OWNER : board.roles?.[uid] || defaultRole;
  return { ok: true, board, isOwner: owner, role };
}
