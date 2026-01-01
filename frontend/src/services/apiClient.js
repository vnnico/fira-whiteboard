import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3001/api",
});
// const api = axios.create({
//   baseURL: "https://aaeb490bc4d0.ngrok-free.app/api",
//   headers: {
//     "ngrok-skip-browser-warning": "true",
//   },
// });

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export default api;
