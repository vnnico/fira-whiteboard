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
    username: "anto",
    password: "anto",
    displayName: "User-000002",
  },
  {
    id: "3",
    username: "nico",
    password: "nico",
    displayName: "User-000003",
  },
  {
    id: "4",
    username: "hansen",
    password: "hansen",
    displayName: "User-000004",
  },
  {
    id: "5",
    username: "wilson",
    password: "wilson",
    displayName: "User-000005",
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
