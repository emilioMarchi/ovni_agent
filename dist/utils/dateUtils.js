import { formatInTimeZone, toDate } from 'date-fns-tz';
const TIMEZONE = 'America/Argentina/Buenos_Aires';
const DAY_NAMES = {
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
export function getTodayDateString() {
    return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
}
/**
 * Obtiene el nombre del día de la semana para una fecha dada (YYYY-MM-DD).
 */
export function getDayName(dateString) {
    const date = toDate(`${dateString}T12:00:00`, { timeZone: TIMEZONE });
    const dayName = formatInTimeZone(date, TIMEZONE, 'EEEE');
    return normalizeDayName(dayName);
}
/**
 * Normaliza el nombre del día (minúsculas, sin acentos).
 */
export function normalizeDayName(day) {
    return (DAY_NAMES[day] || day.toLowerCase())
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}
/**
 * Suma días calendario a una fecha YYYY-MM-DD respetando la zona horaria de Argentina.
 */
export function addDaysToDateString(dateString, days) {
    const date = toDate(`${dateString}T12:00:00`, { timeZone: TIMEZONE });
    date.setDate(date.getDate() + days);
    return formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
}
/**
 * Formatea una fecha ISO para mostrarla al usuario: "Martes 31 de marzo".
 */
export function formatFriendlyDate(dateString) {
    const date = toDate(`${dateString}T12:00:00`, { timeZone: TIMEZONE });
    return formatInTimeZone(date, TIMEZONE, "EEEE d 'de' MMMM");
}
//# sourceMappingURL=dateUtils.js.map