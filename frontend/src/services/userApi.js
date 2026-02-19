import api from "./apiClient";

export async function onboarding() {
  const { data } = await api.post("/user/onboarding");
  return data;
}
