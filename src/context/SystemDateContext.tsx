import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSystemOffset, setSystemOffset, getGlobalSystemDate } from '../utils/systemDateState';

interface SystemDateContextType {
  systemDate: Date;
  setSystemDate: (date: Date) => void;
  resetSystemDate: () => void;
  isDateOverridden: boolean;
}

const SystemDateContext = createContext<SystemDateContextType | undefined>(undefined);

export const SystemDateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [systemDate, setSystemDateInternal] = useState<Date>(() => getGlobalSystemDate());
  const [isDateOverridden, setIsDateOverridden] = useState(() => getSystemOffset() !== 0);

  const setSystemDate = (date: Date) => {
    const offset = date.getTime() - Date.now();
    setSystemOffset(offset);
    setSystemDateInternal(new Date(Date.now() + offset));
    setIsDateOverridden(offset !== 0);
  };

  const resetSystemDate = () => {
    setSystemOffset(null);
    setSystemDateInternal(new Date());
    setIsDateOverridden(false);
  };

  // Update "now" if not overridden to keep the clock ticking
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemDateInternal(getGlobalSystemDate());
    }, 1000); // Update every second for a real-time feel
    return () => clearInterval(timer);
  }, []);

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
