import React, { createContext, useContext, useState, useEffect } from 'react';

interface SystemDateContextType {
  systemDate: Date;
  setSystemDate: (date: Date) => void;
  resetSystemDate: () => void;
  isDateOverridden: boolean;
}

const SystemDateContext = createContext<SystemDateContextType | undefined>(undefined);

// Global fallback for non-React code (e.g. dateUtils.ts)
let globalSystemDate: Date | null = null;

export const getGlobalSystemDate = (): Date | null => {
  if (globalSystemDate) return globalSystemDate;
  const saved = localStorage.getItem('app_system_date');
  if (saved) {
    const d = new Date(saved);
    if (!isNaN(d.getTime())) {
      globalSystemDate = d;
      return d;
    }
  }
  return null;
};

export const SystemDateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [systemDate, setSystemDateInternal] = useState<Date>(() => {
    const d = getGlobalSystemDate();
    return d || new Date();
  });
  const [isDateOverridden, setIsDateOverridden] = useState(() => !!getGlobalSystemDate());

  const setSystemDate = (date: Date) => {
    setSystemDateInternal(date);
    setIsDateOverridden(true);
    globalSystemDate = date;
    localStorage.setItem('app_system_date', date.toISOString());
  };

  const resetSystemDate = () => {
    const now = new Date();
    setSystemDateInternal(now);
    setIsDateOverridden(false);
    globalSystemDate = null;
    localStorage.removeItem('app_system_date');
  };

  // Update "now" if not overridden
  useEffect(() => {
    if (!isDateOverridden) {
      const timer = setInterval(() => {
        setSystemDateInternal(new Date());
      }, 60000); // Update every minute
      return () => clearInterval(timer);
    }
  }, [isDateOverridden]);

  return (
    <SystemDateContext.Provider value={{ systemDate, setSystemDate, resetSystemDate, isDateOverridden }}>
      {children}
    </SystemDateContext.Provider>
  );
};

export const useSystemDate = () => {
  const context = useContext(SystemDateContext);
  if (!context) {
    throw new Error('useSystemDate must be used within a SystemDateProvider');
  }
  return context;
};
