import React, { createContext, useContext, useState, useEffect } from 'react';

interface SystemDateContextType {
  systemDate: Date;
  setSystemDate: (date: Date) => void;
  resetSystemDate: () => void;
  isDateOverridden: boolean;
}

const SystemDateContext = createContext<SystemDateContextType | undefined>(undefined);

export const SystemDateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [systemDate, setSystemDateInternal] = useState<Date>(new Date());
  const [isDateOverridden, setIsDateOverridden] = useState(false);

  // Initialize from localStorage if exists
  useEffect(() => {
    const savedDate = localStorage.getItem('app_system_date');
    if (savedDate) {
      setSystemDateInternal(new Date(savedDate));
      setIsDateOverridden(true);
    }
  }, []);

  const setSystemDate = (date: Date) => {
    setSystemDateInternal(date);
    setIsDateOverridden(true);
    localStorage.setItem('app_system_date', date.toISOString());
  };

  const resetSystemDate = () => {
    const now = new Date();
    setSystemDateInternal(now);
    setIsDateOverridden(false);
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
