// Dummy users; nanti bisa diganti Mongo schema
const users = [
  {
    id: "1",
    username: "admin",
    password: "admin", // plain text hanya untuk dummy!
    displayName: "User-000001",
  },
  {
    id: "2",
    username: "testuser",
    password: "password123",
    displayName: "User-000002",
  },
];

export function findByUsername(username) {
  return users.find((u) => u.username === username);
}

export function findById(id) {
  return users.find((u) => u.id === id);
}

export function updateDisplayName(id, newName) {
  const user = findById(id);
  if (user) {
    user.displayName = newName;
  }
  return user;
}

export function generateRandomDisplayName() {
  const random = String(Math.floor(Math.random() * 999999)).padStart(6, "0");
  return `User-${random}`;
}
