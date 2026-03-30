import admin from "firebase-admin";
import { formatInTimeZone, toDate } from "date-fns-tz";
import { formatFriendlyDate, formatGroupedSlots, getDayName } from "../utils/dateUtils.js";

interface BusinessHours {
  enabled: boolean;
  ranges: Array<{ start: string; end: string }>;
}

interface DayConfig {
  [day: string]: BusinessHours;
}

interface AvailableSlots {
  availableSlots: string[];
  availableRanges: string[];
  bookedSlots: string[];
  businessHours: BusinessHours;
}

const DEFAULT_BUSINESS_HOURS: DayConfig = {
  lunes: { enabled: true, ranges: [{ start: "10:00", end: "14:00" }, { start: "16:00", end: "19:00" }] },
  martes: { enabled: true, ranges: [{ start: "10:00", end: "14:00" }, { start: "16:00", end: "19:00" }] },
  miercoles: { enabled: true, ranges: [{ start: "10:00", end: "14:00" }, { start: "16:00", end: "19:00" }] },
  jueves: { enabled: true, ranges: [{ start: "10:00", end: "14:00" }, { start: "16:00", end: "19:00" }] },
  viernes: { enabled: true, ranges: [{ start: "10:00", end: "14:00" }, { start: "16:00", end: "19:00" }] },
  sabado: { enabled: false, ranges: [] },
  domingo: { enabled: false, ranges: [] },
};

const TIMEZONE = "America/Argentina/Buenos_Aires";

function parseDateInTimezone(date: string): Date {
  return toDate(`${date}T12:00:00`, { timeZone: TIMEZONE });
}

function getDayNameForDate(date: string): string {
  return getDayName(date);
}

function formatDateForDisplay(date: string): string {
  const dateObj = parseDateInTimezone(date);
  return `${formatFriendlyDate(date)} de ${formatInTimeZone(dateObj, TIMEZONE, "yyyy")}`;
}

function generateTimeSlots(start: string, end: string): string[] {
  const slots: string[] = [];
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);

  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (currentMinutes < endMinutes) {
    const h = Math.floor(currentMinutes / 60);
    const m = currentMinutes % 60;
    slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    currentMinutes += 30;
  }

  return slots;
}

export async function getAvailableSlots(clientId: string, date: string): Promise<AvailableSlots> {
  const db = admin.firestore();
  const normalizedDay = getDayNameForDate(date);

  let businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS[normalizedDay] || { enabled: false, ranges: [] };

  try {
    const adminDoc = await db.collection("admins").doc(clientId).get();
    const clientBusinessHours = adminDoc.data()?.businessHours;
    
    if (clientBusinessHours && clientBusinessHours[normalizedDay]) {
      businessHours = clientBusinessHours[normalizedDay];
    }
  } catch (e) {
    console.error("Error getting business hours:", e);
  }

  if (!businessHours.enabled) {
    return {
      availableSlots: [],
      availableRanges: [],
      bookedSlots: [],
      businessHours,
    };
  }

  let allSlots: string[] = [];
  for (const range of businessHours.ranges) {
    allSlots = allSlots.concat(generateTimeSlots(range.start, range.end));
  }

  const meetingsSnapshot = await db
    .collection("meetings")
    .where("clientId", "==", clientId)
    .where("date", "==", date)
    .get();

  const bookedSlots = meetingsSnapshot.docs
    .map((doc) => doc.data())
    .filter((meeting) => {
      const status = String(meeting.status || "").toLowerCase();
      return status !== "cancelled" && status !== "canceled" && status !== "rejected";
    })
    .map((meeting) => meeting.time)
    .filter(Boolean);

  const availableSlots = allSlots.filter((slot) => !bookedSlots.includes(slot));

  const availableRanges = businessHours.ranges.map((range) => `${range.start} - ${range.end}`);

  return {
    availableSlots,
    availableRanges,
    bookedSlots,
    businessHours,
  };
}

export async function formatAvailabilityMessage(
  clientId: string,
  date: string
): Promise<string> {
  const { availableSlots, availableRanges, bookedSlots, businessHours } = await getAvailableSlots(
    clientId,
    date
  );

  const formattedDate = formatDateForDisplay(date);

  if (!businessHours.enabled) {
    return `No atendemos el ${formattedDate}. Nuestros horarios son de lunes a viernes de 10:00 a 14:00 y de 16:00 a 19:00.`;
  }

  if (availableSlots.length === 0) {
    return `No hay horarios disponibles para el ${formattedDate}. Todos los turnos están ocupados.`;
  }

  const groupedAvailability = formatGroupedSlots(availableSlots);

  return `Horarios disponibles para el ${formattedDate}:
${availableRanges.join(", ")}

Turnos libres: ${groupedAvailability}

(${bookedSlots.length} turnos ya reservados)`;
}
