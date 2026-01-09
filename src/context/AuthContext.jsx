import React, { createContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { me } from "../api/auth";

export const AuthContext = createContext(null);

const TOKEN_KEY = "londoncaf_token";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function signIn(newToken, newUser) {
    setToken(newToken);
    setUser(newUser);
    await AsyncStorage.setItem(TOKEN_KEY, newToken);
  }

  async function signOut() {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem(TOKEN_KEY);
  }

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(TOKEN_KEY);
        if (!saved) return;
        setToken(saved);

        const data = await me(saved);
        setUser(data.user);
      } catch (e) {
        await AsyncStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    // si no había token guardado, igual quitamos loading
    if (token === null) setLoading(false);
  }, [token]);

  const value = useMemo(
    () => ({ token, user, loading, signIn, signOut, setUser }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
