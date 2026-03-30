import { formatInTimeZone, toDate } from 'date-fns-tz';

const TIMEZONE = 'America/Argentina/Buenos_Aires';

const DAY_NAMES: Record<string, string> = {
  'Sunday': 'domingo',
  'Monday': 'lunes',
  'Tuesday': 'martes',
  'Wednesday': 'miercoles',
  'Thursday': 'jueves',
  'Friday': 'viernes',
  'Saturday': 'sabado',
};

/**
 * Obtiene la fecha actual en la zona horaria de Argentina en formato YYYY-MM-DD.
 */
export function getTodayDateString(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Obtiene el nombre del día de la semana para una fecha dada (YYYY-MM-DD).
 */
export function getDayName(dateString: string): string {
  const date = toDate(`${dateString}T12:00:00`, { timeZone: TIMEZONE });
  const dayName = formatInTimeZone(date, TIMEZONE, 'EEEE');
  return normalizeDayName(dayName);
}

/**
 * Normaliza el nombre del día (minúsculas, sin acentos).
 */
export function normalizeDayName(day: string): string {
  return (DAY_NAMES[day] || day.toLowerCase())
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Suma días calendario a una fecha YYYY-MM-DD respetando la zona horaria de Argentina.
 */
export function addDaysToDateString(dateString: string, days: number): string {
  const date = toDate(`${dateString}T12:00:00`, { timeZone: TIMEZONE });
  date.setDate(date.getDate() + days);
  return formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
}

export function timeStringToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTimeString(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function normalizeTimeInput(rawTime: string): string {
  const normalized = rawTime
    .toLowerCase()
    .trim()
    .replace(/hs?\.?|horas?/g, '')
    .replace(/\./g, ':')
    .replace(/\s+/g, ' ')
    .trim();

  let match = normalized.match(/^(\d{1,2})\s*y\s+media$/);
  if (match) {
    return `${match[1].padStart(2, '0')}:30`;
  }

  match = normalized.match(/^(\d{1,2})\s+(30)$/);
  if (match) {
    return `${match[1].padStart(2, '0')}:30`;
  }

  match = normalized.match(/^(\d{1,2})(?::|h)?(\d{2})$/);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }

  match = normalized.match(/^(\d{1,2})$/);
  if (match) {
    return `${match[1].padStart(2, '0')}:00`;
  }

  return rawTime.trim();
}

export function formatTimeNatural(time: string): string {
  const normalized = normalizeTimeInput(time);
  const [hours, minutes] = normalized.split(':').map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return time;
  }

  if (minutes === 0) {
    return String(hours);
  }

  if (minutes === 30) {
    return `${hours} y media`;
  }

  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

export function formatGroupedSlots(slots: string[]): string {
  if (slots.length === 0) return '';

  const uniqueSorted = [...new Set(slots.map(normalizeTimeInput))]
    .sort((a, b) => timeStringToMinutes(a) - timeStringToMinutes(b));

  const groups: Array<{ start: string; end: string }> = [];
  let currentStart = uniqueSorted[0];
  let previous = uniqueSorted[0];

  for (let index = 1; index < uniqueSorted.length; index += 1) {
    const current = uniqueSorted[index];
    if (timeStringToMinutes(current) - timeStringToMinutes(previous) !== 30) {
      groups.push({ start: currentStart, end: previous });
      currentStart = current;
    }
    previous = current;
  }

  groups.push({ start: currentStart, end: previous });

  return groups.map((group) => {
    if (group.start === group.end) {
      return `a las ${formatTimeNatural(group.start)}`;
    }

    const endPlusThirty = minutesToTimeString(timeStringToMinutes(group.end) + 30);
    return `de ${formatTimeNatural(group.start)} a ${formatTimeNatural(endPlusThirty)}`;
  }).join(' y ');
}

/**
 * Formatea una fecha ISO para mostrarla al usuario: "Martes 31 de marzo".
 */
export function formatFriendlyDate(dateString: string): string {
  const date = toDate(`${dateString}T12:00:00`, { timeZone: TIMEZONE });
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TIMEZONE,
  }).format(date);
}
