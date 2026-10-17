export const getSystemTimestamp = (): number => {
  const overriddenDate = localStorage.getItem('app_system_date');
  if (overriddenDate) {
    const d = new Date(overriddenDate);
    if (!isNaN(d.getTime())) {
      return d.getTime();
    }
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
