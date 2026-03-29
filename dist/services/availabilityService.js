import admin from "firebase-admin";
const DEFAULT_BUSINESS_HOURS = {
    lunes: { enabled: true, ranges: [{ start: "10:00", end: "14:00" }, { start: "16:00", end: "19:00" }] },
    martes: { enabled: true, ranges: [{ start: "10:00", end: "14:00" }, { start: "16:00", end: "19:00" }] },
    miercoles: { enabled: true, ranges: [{ start: "10:00", end: "14:00" }, { start: "16:00", end: "19:00" }] },
    jueves: { enabled: true, ranges: [{ start: "10:00", end: "14:00" }, { start: "16:00", end: "19:00" }] },
    viernes: { enabled: true, ranges: [{ start: "10:00", end: "14:00" }, { start: "16:00", end: "19:00" }] },
    sabado: { enabled: false, ranges: [] },
    domingo: { enabled: false, ranges: [] },
};
function normalizeDayName(day) {
    return day
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}
function generateTimeSlots(start, end) {
    const slots = [];
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
export async function getAvailableSlots(clientId, date) {
    const db = admin.firestore();
    const dateObj = new Date(date);
    const dayName = dateObj.toLocaleDateString("es-AR", { weekday: "long", timeZone: "America/Argentina/Buenos_Aires" });
    const normalizedDay = normalizeDayName(dayName);
    let businessHours = DEFAULT_BUSINESS_HOURS[normalizedDay] || { enabled: false, ranges: [] };
    try {
        const configDoc = await db.collection("config").doc(clientId).get();
        const clientBusinessHours = configDoc.data()?.businessHours;
        if (clientBusinessHours && clientBusinessHours[normalizedDay]) {
            businessHours = clientBusinessHours[normalizedDay];
        }
    }
    catch (e) {
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
    let allSlots = [];
    for (const range of businessHours.ranges) {
        allSlots = allSlots.concat(generateTimeSlots(range.start, range.end));
    }
    const meetingsSnapshot = await db
        .collection("meetings")
        .where("clientId", "==", clientId)
        .where("date", "==", date)
        .get();
    const bookedSlots = meetingsSnapshot.docs
        .map((doc) => doc.data().time)
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
export async function formatAvailabilityMessage(clientId, date) {
    const { availableSlots, availableRanges, bookedSlots, businessHours } = await getAvailableSlots(clientId, date);
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString("es-AR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "America/Argentina/Buenos_Aires",
    });
    if (!businessHours.enabled) {
        return `No atendemos el ${formattedDate}. Nuestros horarios son de lunes a viernes de 10:00 a 14:00 y de 16:00 a 19:00.`;
    }
    if (availableSlots.length === 0) {
        return `No hay horarios disponibles para el ${formattedDate}. Todos los turnos están ocupados.`;
    }
    return `Horarios disponibles para el ${formattedDate}:
${availableRanges.join(", ")}

Turnos libres: ${availableSlots.join(", ")}

(${bookedSlots.length} turnos ya reservados)`;
}
//# sourceMappingURL=availabilityService.js.map