import { useState, useEffect, useCallback } from 'react';
import { apiFetch, setToken, clearToken } from '../api/client';

import { AuthContext } from './auth-state';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('token')));

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('token');
    if (!token) return;
    async function loadUser() {
      try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        const profile = await apiFetch(`/api/users/${payload.userId}`);
        if (!cancelled) setUser(profile);
      } catch {
        if (!cancelled) clearToken();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadUser();
    return () => { cancelled = true; };
  }, []);

  const loginWithToken = useCallback(async (token) => {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    setToken(token);
    try {
      const profile = await apiFetch(`/api/users/${payload.userId}`);
      setUser(profile);
    } catch (error) {
      clearToken();
      throw error;
    }
  }, []);

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
