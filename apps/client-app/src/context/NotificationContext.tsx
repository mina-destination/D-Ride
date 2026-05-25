import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
}

interface NotificationContextType {
  notifications: AppNotification[];
  addNotification: (title: string, description: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toast, setToast] = useState<{ id: string; title: string; description: string } | null>(null);

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

    // Trigger screen toast
    setToast(newNotif);
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
    <NotificationContext.Provider value={{ notifications, addNotification, markRead, markAllRead, clearNotifications }}>
      {children}
      
      {/* Premium Screen Toast Overlay */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: 'rgba(14, 14, 27, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderLeft: '4px solid var(--primary)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3), 0 0 15px rgba(245, 183, 49, 0.15)',
          width: '320px',
          color: 'var(--text-primary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          animation: 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary)' }}>{toast.title}</span>
            <button 
              onClick={() => setToast(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}
            >
              ✕
            </button>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{toast.description}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'flex-end', marginTop: '4px' }}>Just now</span>
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
