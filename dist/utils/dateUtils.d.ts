/**
 * Obtiene la fecha actual en la zona horaria de Argentina en formato YYYY-MM-DD.
 */
export declare function getTodayDateString(): string;
/**
 * Obtiene el nombre del día de la semana para una fecha dada (YYYY-MM-DD).
 */
export declare function getDayName(dateString: string): string;
/**
 * Normaliza el nombre del día (minúsculas, sin acentos).
 */
export declare function normalizeDayName(day: string): string;
/**
 * Suma días calendario a una fecha YYYY-MM-DD respetando la zona horaria de Argentina.
 */
export declare function addDaysToDateString(dateString: string, days: number): string;
export declare function timeStringToMinutes(time: string): number;
export declare function minutesToTimeString(totalMinutes: number): string;
export declare function normalizeTimeInput(rawTime: string): string;
export declare function formatTimeNatural(time: string): string;
export declare function formatGroupedSlots(slots: string[]): string;
/**
 * Formatea una fecha ISO para mostrarla al usuario: "Martes 31 de marzo".
 */
export declare function formatFriendlyDate(dateString: string): string;
