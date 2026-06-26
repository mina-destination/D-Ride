import React, { createContext, useContext, useEffect } from 'react';
import { getCSSVariables } from '@transport/shared-theme';

interface ThemeContextType {
  theme: 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Lock to dark theme — no toggle, no localStorage branching
    document.documentElement.setAttribute('data-theme', 'dark');

    try {
      const vars = getCSSVariables('dark');
      Object.entries(vars).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
    } catch (error) {
      console.error('Failed to apply shared theme CSS variables:', error);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
