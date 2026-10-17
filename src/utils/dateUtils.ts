import { getGlobalSystemTimestamp } from './systemDateState';

export const getSystemTimestamp = (): number => {
  try {
    return getGlobalSystemTimestamp();
  } catch (e) {
    console.error('Error reading system date:', e);
  }
  return Date.now();
};

export const getSystemDate = (): Date => {
  return new Date(getSystemTimestamp());
};

export const getSystemDateString = (): string => {
  return getSystemDate().toISOString().split('T')[0];
};

export const formatAppDate = (date: any) => {
  if (!date) return '';
  const d = typeof date === 'number' || typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatAppDateTime = (date: any) => {
  if (!date) return '';
  const d = typeof date === 'number' || typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
