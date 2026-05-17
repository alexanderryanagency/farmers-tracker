export const CONFIRMED_2026_FOLIOS = [
  { name: 'May 2026 Folio', start: '2026-04-18', end: '2026-05-19' },
  { name: 'June 2026 Folio', start: '2026-05-20', end: '2026-06-18' },
  { name: 'July 2026 Folio', start: '2026-06-19', end: '2026-07-17' },
];

// Farmers may switch to calendar-month sales cycles later in 2026; update this
// confirmed folio config once the remaining 2026 schedule is known.
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
  const today = parseLocalDate(typeof date === 'string' ? date : getLocalDateString(date));
  const end = parseLocalDate(endDateStr);
  return Math.max(0, Math.ceil((end - today) / 86400000));
}

function formatShortDate(dateStr) {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parseLocalDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
