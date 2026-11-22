import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authService, AuthUser, RegisterUserPayload } from '../services/authService';
import { registerUnauthorizedHandler, setInMemoryAuthToken } from '../services/api';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  registerUser: (payload: RegisterUserPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);

  const clearSession = useCallback(() => {
    setInMemoryAuthToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(clearSession);
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authService.login(email, password);
    setInMemoryAuthToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const registerUser = useCallback(async (payload: RegisterUserPayload) => {
    const data = await authService.register(payload);
    setInMemoryAuthToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore network errors during logout cleanup
    } finally {
      clearSession();
    }
  }, [clearSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        login,
        registerUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
