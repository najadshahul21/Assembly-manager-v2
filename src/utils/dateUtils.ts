/**
 * Date formatting utility functions adhering to "dd/(month name)/yyyy"
 * Example output: "22/September/2026", "18/May/2026", "13/May/2001"
 */

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

/**
 * Format any date input into "dd/(month name)/yyyy"
 * @param dateVal Date, timestamp, or string
 * @returns formatted date string e.g. "22/September/2026"
 */
export const formatAppDate = (dateVal: any): string => {
  if (!dateVal && dateVal !== 0) return '';

  // If number timestamp
  if (typeof dateVal === 'number') {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = MONTH_NAMES[d.getMonth()];
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }

  // If Date object
  if (dateVal instanceof Date) {
    if (!isNaN(dateVal.getTime())) {
      const day = String(dateVal.getDate()).padStart(2, '0');
      const month = MONTH_NAMES[dateVal.getMonth()];
      const year = dateVal.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }

  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (!trimmed) return '';

    // If string like "YYYY-MM-DD"
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const monthIdx = parseInt(isoMatch[2], 10) - 1;
      const day = isoMatch[3];
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${day}/${MONTH_NAMES[monthIdx]}/${year}`;
      }
    }

    // If string like "MM/DD/YYYY"
    const mmddyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyyMatch) {
      const monthIdx = parseInt(mmddyyyyMatch[1], 10) - 1;
      const day = String(parseInt(mmddyyyyMatch[2], 10)).padStart(2, '0');
      const year = mmddyyyyMatch[3];
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${day}/${MONTH_NAMES[monthIdx]}/${year}`;
      }
    }

    // If string like "DD-MM-YYYY" or "DD/MM/YYYY"
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmmyyyyMatch) {
      const day = String(parseInt(ddmmyyyyMatch[1], 10)).padStart(2, '0');
      const monthIdx = parseInt(ddmmyyyyMatch[2], 10) - 1;
      const year = ddmmyyyyMatch[3];
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${day}/${MONTH_NAMES[monthIdx]}/${year}`;
      }
    }

    // If string like "18 May 2026" or parseable date string
    const d = new Date(trimmed);
    if (!isNaN(d.getTime()) && !/^\d{4}$/.test(trimmed)) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = MONTH_NAMES[d.getMonth()];
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }

    return trimmed;
  }

  return String(dateVal);
};

/**
 * Format date with time into "dd/(month name)/yyyy, hh:mm AM/PM"
 */
export const formatAppDateTime = (dateVal: any): string => {
  if (!dateVal && dateVal !== 0) return '';
  const d = typeof dateVal === 'number' || typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  if (d instanceof Date && !isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTH_NAMES[d.getMonth()];
    const year = d.getFullYear();
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${day}/${month}/${year}, ${timeStr}`;
  }
  return formatAppDate(dateVal);
};

/**
 * Format date range into "dd/(month name)/yyyy – dd/(month name)/yyyy"
 */
export const formatAppDateRange = (startDateVal: any, endDateVal: any, fallbackRange?: string): string => {
  const startStr = startDateVal ? formatAppDate(startDateVal) : '';
  const endStr = endDateVal ? formatAppDate(endDateVal) : '';

  if (startStr && endStr) {
    return `${startStr} – ${endStr}`;
  }

  if (fallbackRange) {
    const parts = fallbackRange.split(/\s*[-–]\s*/);
    if (parts.length === 2) {
      const p0 = formatAppDate(parts[0]);
      const p1 = parts[1].toLowerCase() === 'present' ? 'Present' : formatAppDate(parts[1]);
      return `${p0} – ${p1}`;
    }
    return fallbackRange.replace(/\s*-\s*/, ' – ');
  }

  if (startStr) return startStr;
  return 'Past Term';
};
