import { formatInTimeZone, toDate } from 'date-fns-tz';

const TIMEZONE = 'America/Argentina/Buenos_Aires';

const DAY_NAMES: Record<string, string> = {
  'Sunday': 'domingo',
  'Monday': 'martes',
  'Tuesday': 'miércoles',
  'Wednesday': 'jueves',
  'Thursday': 'viernes',
  'Friday': 'sábado',
  'Saturday': 'domingo',
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
  return DAY_NAMES[day] || day.toLowerCase();
}

/**
 * Formatea una fecha ISO para mostrarla al usuario: "Martes 31 de marzo".
 */
export function formatFriendlyDate(dateString: string): string {
  const date = toDate(`${dateString}T12:00:00`, { timeZone: TIMEZONE });
  return formatInTimeZone(date, TIMEZONE, "EEEE d 'de' MMMM");
}
