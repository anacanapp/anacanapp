const DAY_MS = 86_400_000;

// Work with date-only UTC values, not elapsed 24-hour periods or the host TZ.
// Callers read PostgreSQL DATE columns as text to preserve the written birthday.
function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function getNotificationDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Baku', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function getBabyDayNumber(birthDate, today) {
  const birth = parseDate(birthDate), date = parseDate(today);
  if (!birth || !date || date < birth) return null;
  return Math.round((date - birth) / DAY_MS) + 1;
}

export function getMonthAnniversary(birthDate, months) {
  const birth = parseDate(birthDate);
  if (!birth || !Number.isInteger(months) || months < 1 || months > 48) return null;
  const start = new Date(Date.UTC(birth.getUTCFullYear(), birth.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  start.setUTCDate(Math.min(birth.getUTCDate(), lastDay));
  return start.toISOString().slice(0, 10);
}

const hasCalendarRule = row => row.calendar_months != null || row.calendar_day_offset != null;

export function isMommyNotificationDue(row, birthDate, today) {
  const dayNumber = getBabyDayNumber(birthDate, today);
  if (dayNumber === null) return false;
  if (!hasCalendarRule(row)) return dayNumber <= 1460 && row.day_number === dayNumber;

  // A partial/invalid calendar rule must never fall back to the old day index.
  if (!Number.isInteger(row.calendar_day_offset) || Math.abs(row.calendar_day_offset) > 366) return false;
  const anniversary = parseDate(getMonthAnniversary(birthDate, row.calendar_months));
  if (!anniversary) return false;
  anniversary.setUTCDate(anniversary.getUTCDate() + row.calendar_day_offset);
  return anniversary.toISOString().slice(0, 10) === today;
}

export function indexMommyNotifications(rows) {
  const daily = new Map(), calendar = [];
  for (const row of rows) {
    if (row.is_active === false) continue;
    if (hasCalendarRule(row)) calendar.push(row);
    else daily.set(row.day_number, [...(daily.get(row.day_number) || []), row]);
  }
  // An anniversary itself wins over a countdown. Resolve duplicate legacy
  // countdown templates deterministically instead of sending extra pushes.
  calendar.sort((a, b) => Math.abs(a.calendar_day_offset) - Math.abs(b.calendar_day_offset)
    || b.day_number - a.day_number || String(a.id).localeCompare(String(b.id)));
  return { daily, calendar };
}

export function selectMommyNotifications(index, birthDate, today) {
  const dayNumber = getBabyDayNumber(birthDate, today);
  if (dayNumber === null) return [];
  const dueCalendar = index.calendar.filter(row => isMommyNotificationDue(row, birthDate, today));
  const daily = dayNumber <= 1460 ? index.daily.get(dayNumber) || [] : [];
  const bySlot = new Map();
  for (const row of [...dueCalendar, ...daily]) {
    const slot = String(row.send_time || '').slice(0, 5);
    if (!bySlot.has(slot)) bySlot.set(slot, row);
  }
  return [...bySlot.values()];
}

export function renderMommyNotificationText(text, row, birthDate) {
  const anniversary = parseDate(getMonthAnniversary(birthDate, row.calendar_months));
  const birth = parseDate(birthDate);
  if (!anniversary || !birth) return text;
  // Anniversary copy may mention days too: 3 calendar months are not always 90 days.
  const days = Math.round((anniversary - birth) / DAY_MS);
  return text.replaceAll('{milestone_days}', String(days));
}
