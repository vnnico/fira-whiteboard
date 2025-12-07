import React, { createContext, useEffect, useState } from "react";
import * as authApi from "../services/authApi";

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
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [token]);

  const login = async (username, password) => {
    const { token: newToken, user: loggedUser } = await authApi.login(
      username,
      password
    );
    setToken(newToken);
    setUser(loggedUser);
    localStorage.setItem("fira_token", newToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("fira_token");
  };

  const value = {
    user,
    token,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
