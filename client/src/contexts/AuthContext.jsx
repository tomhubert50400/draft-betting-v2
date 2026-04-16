import { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch, setToken, clearToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      apiFetch(`/api/users/${payload.userId}`)
        .then(setUser)
        .catch(() => { clearToken(); })
        .finally(() => setLoading(false));
    } catch {
      clearToken();
      setLoading(false);
    }
  }, []);

  function loginWithToken(token) {
    setToken(token);
    const payload = JSON.parse(atob(token.split('.')[1]));
    apiFetch(`/api/users/${payload.userId}`).then(setUser);
  }

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

export function useAuth() {
  return useContext(AuthContext);
}
