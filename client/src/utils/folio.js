import folioConfig from '../../../folioConfig.json';

export const CONFIRMED_2026_FOLIOS = folioConfig.folios;
export const FOLIO_GOALS = folioConfig.goals;
export const PRODUCER_PREMIUM_GOAL = FOLIO_GOALS.producerPremium;
export const AGENCY_PREMIUM_GOAL = FOLIO_GOALS.agencyPremium;

export function getActiveFolio(date = new Date()) {
  const dateStr = typeof date === 'string' ? date : getLocalDateString(date);
  return CONFIRMED_2026_FOLIOS.find(folio => dateStr >= folio.start && dateStr <= folio.end) || null;
}

export function getFolioDisplay(folio, date = new Date()) {
  if (!folio) {
    return { label: 'Folio: Not confirmed', daysRemaining: 0 };
  }

  return {
    label: `Folio: ${formatShortDate(folio.start)} – ${formatShortDate(folio.end)}`,
    daysRemaining: getDaysRemaining(folio.end, date),
  };
}

function getDaysRemaining(endDateStr, date) {
  const todayStr = typeof date === 'string' ? date : getLocalDateString(date);
  if (todayStr > endDateStr) return 0;
  let count = 0;
  for (const dateStr of dateRange(todayStr, endDateStr)) {
    if (isBusinessDay(dateStr)) count++;
  }
  return count;
}

function formatShortDate(dateStr) {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parseLocalDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function dateRange(start, end) {
  const dates = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function isBusinessDay(dateStr) {
  const day = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
