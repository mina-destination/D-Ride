import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authAPI } from '../services/api';

interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  syncProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('dride_token'));
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('dride_token');
    localStorage.removeItem('dride_user');
  }, []);

  const syncProfile = useCallback(async () => {
    if (token) {
      try {
        const profile = await authAPI.getProfile();
        setUser(profile);
        localStorage.setItem('dride_user', JSON.stringify(profile));
      } catch (error) {
        console.error('Failed to sync profile permissions dynamically', error);
        // Do not force logout on temporary network loss, only on 401/403
        if (error instanceof Error && (error.message.includes('401') || error.message.includes('403') || error.message.includes('unauthorized'))) {
          logout();
        }
      }
    }
  }, [token, logout]);

  // On mount, check for existing session and refresh profile in background
  useEffect(() => {
    const fetchProfile = async () => {
      if (token) {
        try {
          const profile = await authAPI.getProfile();
          setUser(profile);
          localStorage.setItem('dride_user', JSON.stringify(profile));
        } catch (error) {
          console.error('Failed to sync profile', error);
        }
      }
      setIsLoading(false);
    };

    const storedUser = localStorage.getItem('dride_user');
    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('dride_user');
        localStorage.removeItem('dride_token');
      }
    } else {
      setIsLoading(false);
    }

    fetchProfile();
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const result: any = await authAPI.login(email, password);
    const { user: userData, accessToken } = result;
    
    const adminRoles = ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION'];
    if (!adminRoles.includes(userData?.role?.toUpperCase())) {
      throw new Error('Access denied. Only administrators can sign in to this dashboard.');
    }

    setUser(userData);
    setToken(accessToken);
    localStorage.setItem('dride_token', accessToken);
    localStorage.setItem('dride_user', JSON.stringify(userData));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        syncProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

