/**
 * Global state for the system date offset to break circular dependencies
 * and provide a "ticking" system clock that follows the user's chosen date.
 */

let globalOffset: number | null = null;

/**
 * Calculates the offset between the chosen system date and the real current time.
 * Returns the offset in milliseconds.
 */
export const getSystemOffset = (): number => {
  if (globalOffset !== null) return globalOffset;
  
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem('app_system_date_offset');
    if (saved !== null) {
      const offset = parseInt(saved, 10);
      if (!isNaN(offset)) {
        globalOffset = offset;
        return offset;
      }
    }
    
    // Legacy support for app_system_date
    const legacySaved = localStorage.getItem('app_system_date');
    if (legacySaved) {
      const d = new Date(legacySaved);
      if (!isNaN(d.getTime())) {
        const offset = d.getTime() - Date.now();
        globalOffset = offset;
        localStorage.setItem('app_system_date_offset', offset.toString());
        localStorage.removeItem('app_system_date');
        return offset;
      }
    }
  }
  return 0;
};

export const setSystemOffset = (offset: number | null) => {
  globalOffset = offset;
  if (typeof window !== 'undefined' && window.localStorage) {
    if (offset !== null) {
      localStorage.setItem('app_system_date_offset', offset.toString());
    } else {
      localStorage.removeItem('app_system_date_offset');
      localStorage.removeItem('app_system_date');
    }
  }
};

/**
 * Returns the effective system date as a Date object.
 */
export const getGlobalSystemDate = (): Date => {
  return new Date(Date.now() + getSystemOffset());
};

/**
 * Returns the effective system timestamp.
 */
export const getGlobalSystemTimestamp = (): number => {
  return Date.now() + getSystemOffset();
};
