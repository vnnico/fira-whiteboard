import api, { setAuthToken } from "./apiClient";

export async function login(username, password) {
  const { data } = await api.post("/auth/login", { username, password });
  setAuthToken(data.token);
  return data;
}

export async function getMe(token) {
  setAuthToken(token);
  const { data } = await api.get("/auth/me");
  return data;
}

export async function updateDisplayName(displayName) {
  const { data } = await api.patch("/users/me/display-name", { displayName });
  return data;
}
