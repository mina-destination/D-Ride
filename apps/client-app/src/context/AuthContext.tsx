import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authAPI } from '../services/api';

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
  logout: () => void;
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
    const { user: userData, accessToken } = result;
    
    const adminRoles = ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION'];
    if (adminRoles.includes(userData?.role?.toUpperCase())) {
      throw new Error('Access denied. Administrators cannot sign in to the client application.');
    }

    setUser(userData);
    setToken(accessToken);
    localStorage.setItem('dride_token', accessToken);
    localStorage.setItem('dride_user', JSON.stringify(userData));
  };

  const register = async (data: { name: string; email: string; phone: string; password: string }) => {
    const result: any = await authAPI.register(data);
    const { user: userData, accessToken } = result;
    setUser(userData);
    setToken(accessToken);
    localStorage.setItem('dride_token', accessToken);
    localStorage.setItem('dride_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('dride_token');
    localStorage.removeItem('dride_user');
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!user && !!token, isLoading, login, register, logout }}
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
