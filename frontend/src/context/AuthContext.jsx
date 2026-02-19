import React, { createContext, useEffect, useState } from "react";
import * as authApi from "../services/authApi";
import { setAuthToken } from "../services/apiClient";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("fira_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await authApi.getMe(token);
        setUser(me);
      } catch (err) {
        setToken(null);
        localStorage.removeItem("fira_token");
        setAuthToken(null);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [token]);

  const register = async (username, password) => {
    const { token: newToken, user: newUser } = await authApi.register(
      username,
      password,
    );
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("fira_token", newToken);
  };

  const login = async (username, password) => {
    const { token: newToken, user: loggedUser } = await authApi.login(
      username,
      password,
    );
    setToken(newToken);
    setUser(loggedUser);
    localStorage.setItem("fira_token", newToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("fira_token");
    setAuthToken(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token,
    loading,
    register,
    login,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
