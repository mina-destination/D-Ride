import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api, { authAPI } from '../services/api';
import { socketService } from '../services/socket';

interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  loginWithGoogle: (data: { email: string; name: string; googleId: string }) => Promise<void>;
  logout: () => void;
  updateProfile: (data: { name?: string; phone?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('dride_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('dride_user');
    if (storedUser && token) {
      try {
        const parsedUser = JSON.parse(storedUser);
        const adminRoles = ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION'];
        if (adminRoles.includes(parsedUser?.role?.toUpperCase())) {
          localStorage.removeItem('dride_user');
          localStorage.removeItem('dride_token');
          setUser(null);
        } else {
          setUser(parsedUser);
        }
      } catch {
        localStorage.removeItem('dride_user');
        localStorage.removeItem('dride_token');
      }
    }
    setIsLoading(false);
  }, [token]);

  const login = async (email: string, password: string) => {
    const result: any = await authAPI.login(email, password);
    const { user: userData, accessToken, refreshToken } = result;
    
    const adminRoles = ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION'];
    if (adminRoles.includes(userData?.role?.toUpperCase())) {
      throw new Error('Access denied. Administrators cannot sign in to the client application.');
    }

    setUser(userData);
    setToken(accessToken);
    localStorage.setItem('dride_token', accessToken);
    if (refreshToken) localStorage.setItem('dride_refresh_token', refreshToken);
    localStorage.setItem('dride_user', JSON.stringify(userData));
  };

  const register = async (data: { name: string; email: string; phone: string; password: string }) => {
    const result: any = await authAPI.register(data);
    const { user: userData, accessToken, refreshToken } = result;
    setUser(userData);
    setToken(accessToken);
    localStorage.setItem('dride_token', accessToken);
    if (refreshToken) localStorage.setItem('dride_refresh_token', refreshToken);
    localStorage.setItem('dride_user', JSON.stringify(userData));
  };

  const loginWithGoogle = async (data: { email: string; name: string; googleId: string }) => {
    const result: any = await authAPI.googleLogin(data);
    const { user: userData, accessToken, refreshToken } = result;

    const adminRoles = ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION'];
    if (adminRoles.includes(userData?.role?.toUpperCase())) {
      throw new Error('Access denied. Administrators cannot sign in to the client application.');
    }

    setUser(userData);
    setToken(accessToken);
    localStorage.setItem('dride_token', accessToken);
    if (refreshToken) localStorage.setItem('dride_refresh_token', refreshToken);
    localStorage.setItem('dride_user', JSON.stringify(userData));
  };

  const logout = () => {
    const refreshToken = localStorage.getItem('dride_refresh_token');
    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('dride_token');
    localStorage.removeItem('dride_refresh_token');
    localStorage.removeItem('dride_user');
    socketService.forceDisconnect();
  };

  const updateProfile = async (data: { name?: string; phone?: string }) => {
    const updatedUser: any = await authAPI.updateProfile(data);
    setUser(updatedUser);
    localStorage.setItem('dride_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!user && !!token, isLoading, login, register, loginWithGoogle, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
