import { formatInTimeZone, toDate } from 'date-fns-tz';
import { locale } from 'date-fns/locale/es';

const TIMEZONE = 'America/Argentina/Buenos_Aires';

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
  const dayName = formatInTimeZone(date, TIMEZONE, 'EEEE', { locale });
  return normalizeDayName(dayName);
}

/**
 * Normaliza el nombre del día (minúsculas, sin acentos).
 */
export function normalizeDayName(day: string): string {
  return day
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Formatea una fecha ISO para mostrarla al usuario: "Martes 31 de marzo".
 */
export function formatFriendlyDate(dateString: string): string {
  const date = toDate(`${dateString}T12:00:00`, { timeZone: TIMEZONE });
  return formatInTimeZone(date, TIMEZONE, "EEEE d 'de' MMMM", { locale: require('date-fns/locale/es').default });
}
