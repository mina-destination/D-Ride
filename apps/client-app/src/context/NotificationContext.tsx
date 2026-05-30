import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { registerApiToastCallback } from '../services/api';

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
}

export interface ToastMessage {
  id: string;
  title: string;
  description: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface NotificationContextType {
  notifications: AppNotification[];
  addNotification: (title: string, description: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  showToast: (title: string, description: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (title: string, description: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const newToast: ToastMessage = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      description,
      type
    };
    setToast(newToast);
  };

  // Register global Axios toast callback
  useEffect(() => {
    registerApiToastCallback(showToast);
    return () => registerApiToastCallback(null);
  }, []);

  // Load from local storage on mount
  useEffect(() => {
    const stored = localStorage.getItem('dride_notifications');
    if (stored) {
      try {
        setNotifications(JSON.parse(stored));
      } catch {
        setNotifications([]);
      }
    } else {
      // Default welcome notification
      const defaultNotification: AppNotification = {
        id: 'welcome',
        title: 'Welcome to D-Ride! 🚌',
        description: 'Thank you for choosing us for your daily commute. Book your first ride today!',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false
      };
      setNotifications([defaultNotification]);
      localStorage.setItem('dride_notifications', JSON.stringify([defaultNotification]));
    }
  }, []);

  const addNotification = (title: string, description: string) => {
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      description,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false
    };

    setNotifications(prev => {
      const updated = [newNotif, ...prev];
      localStorage.setItem('dride_notifications', JSON.stringify(updated));
      return updated;
    });

    // Trigger screen toast as info
    showToast(title, description, 'info');
  };

  const markRead = (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      localStorage.setItem('dride_notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const markAllRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem('dride_notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const clearNotifications = () => {
    setNotifications([]);
    localStorage.removeItem('dride_notifications');
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, markRead, markAllRead, clearNotifications, showToast }}>
      {children}
      
      {/* Premium Screen Toast Overlay */}
      {toast && (
        <div className={`toast-container`}>
          <div className={`toast-box toast-${toast.type}`}>
            <div className="toast-header">
              <span className="toast-title">{toast.title}</span>
              <button onClick={() => setToast(null)} className="toast-close">✕</button>
            </div>
            <span className="toast-desc">{toast.description}</span>
            <span className="toast-time">Just now</span>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
}

