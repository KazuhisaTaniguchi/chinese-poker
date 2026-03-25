import { useState, useEffect, useCallback } from 'react';
import * as authApi from '../authApi.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 初回: ログイン状態チェック
  useEffect(() => {
    authApi.getMe()
      .then(data => {
        setUser(data.user !== undefined ? (data.user ? data : null) : data);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password);
    setUser(data);
    return data;
  }, []);

  const register = useCallback(async (username, password) => {
    const data = await authApi.register(username, password);
    setUser(data);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return { user, loading, login, register, logout };
}
