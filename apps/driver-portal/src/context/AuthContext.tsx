import React, { createContext, useContext, useState, useEffect } from 'react';
import { driverAPI } from '../services/api';
import { socketService } from '../services/socket';

interface AuthContextType {
  user: any | null;
  token: string | null;
  loading: boolean;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('dride_driver_token'));
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem('dride_driver_token');
    setToken(null);
    setUser(null);
    socketService.forceDisconnect();
  };

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const profileRes: any = await driverAPI.getProfile();
          const profileData = profileRes.data || profileRes;
          const role = profileData.role?.toUpperCase();
          if (role === 'DRIVER') {
            setUser(profileData);
          } else {
            throw new Error('Access denied. Not authorized as driver.');
          }
        } catch (error) {
          console.error('Session initialization failed', error);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [token]);

  const login = async (credentials: any) => {
    setLoading(true);
    try {
      const res: any = await driverAPI.login(credentials);
      const loginData = res.data || res;
      const role = loginData.user?.role?.toUpperCase();
      
      if (role !== 'DRIVER') {
        throw new Error('Access denied. Not authorized as driver.');
      }

      const tokenValue = loginData.accessToken || loginData.token;
      localStorage.setItem('dride_driver_token', tokenValue);
      setToken(tokenValue);
      setUser(loginData.user);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
