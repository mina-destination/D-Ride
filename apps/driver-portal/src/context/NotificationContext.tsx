import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { registerApiToastCallback } from '../services/api';

export interface ToastMessage {
  id: string;
  title: string;
  description: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface NotificationContextType {
  showToast: (title: string, description: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
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

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <NotificationContext.Provider value={{ showToast }}>
      {children}
      
      {/* Premium Screen Toast Overlay */}
      {toast && (
        <div className="toast-container">
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
