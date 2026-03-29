import admin from "firebase-admin";
import { google } from "googleapis";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const oauth2Client = new google.auth.OAuth2(
  getRequiredEnv("GOOGLE_CLIENT_ID"),
  getRequiredEnv("GOOGLE_CLIENT_SECRET"),
  getRequiredEnv("GOOGLE_REDIRECT_URI")
);

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

export interface CalendarTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export async function getCalendarClient(clientId: string) {
  const db = admin.firestore();
  // Buscamos el documento del admin por el clientId
  const adminDoc = await db.collection("admins").doc(clientId).get();
  const tokens = adminDoc.data()?.googleCalendar?.tokens;

  if (!tokens) {
    throw new Error("Google Calendar no conectado para este clientId en colección 'admins'");
  }

  oauth2Client.setCredentials(tokens);

  oauth2Client.on("tokens", async (newTokens: { access_token?: string; expiry_date?: number }) => {
    if (newTokens.access_token) {
      await db.collection("admins").doc(clientId).update({
        "googleCalendar.tokens.access_token": newTokens.access_token,
        "googleCalendar.tokens.expiry_date": newTokens.expiry_date,
      });
    }
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

export async function createCalendarEvent(
  clientId: string,
  meetingData: {
    date: string;
    time: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    topic?: string;
    status?: string;
  }
) {
  const calendar = await getCalendarClient(clientId);
  
  const [hours, minutes] = meetingData.time.split(":").map(Number);
  const startDateTime = new Date(`${meetingData.date}T${meetingData.time}:00`);
  const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000);

  const event = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: `${meetingData.status === "confirmed" ? "✅" : "⏳"} Reunión: ${meetingData.topic || "Consulta"}`,
      description: `
Cliente: ${meetingData.customerName}
Email: ${meetingData.customerEmail}
Teléfono: ${meetingData.customerPhone || "No proporcionado"}
Fecha: ${meetingData.date}
Hora: ${meetingData.time}
Estado: ${meetingData.status || "pendiente"}
      `.trim(),
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: "America/Argentina/Buenos_Aires",
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: "America/Argentina/Buenos_Aires",
      },
      attendees: [
        { email: meetingData.customerEmail },
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 12 * 60 },
          { method: "popup", minutes: 30 },
        ],
      },
      colorId: meetingData.status === "confirmed" ? "9" : "4",
    },
    conferenceDataVersion: 1,
    sendUpdates: meetingData.status === "confirmed" ? "all" : "none",
  });

  return event.data;
}

export async function updateCalendarEvent(
  clientId: string,
  eventId: string,
  meetingData: Partial<{
    date: string;
    time: string;
    topic: string;
    status: string;
    customerName: string;
    customerEmail: string;
  }>
) {
  const calendar = await getCalendarClient(clientId);

  const updates: Record<string, any> = {};

  if (meetingData.topic) {
    updates.summary = `${meetingData.status === "confirmed" ? "✅" : "⏳"} Reunión: ${meetingData.topic}`;
  }

  if (meetingData.status) {
    updates.colorId = meetingData.status === "confirmed" ? "9" : "4";
    updates.sendUpdates = "all";
  }

  if (meetingData.date && meetingData.time) {
    const startDateTime = new Date(`${meetingData.date}T${meetingData.time}:00`);
    const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000);
    updates.start = { dateTime: startDateTime.toISOString(), timeZone: "America/Argentina/Buenos_Aires" };
    updates.end = { dateTime: endDateTime.toISOString(), timeZone: "America/Argentina/Buenos_Aires" };
  }

  const event = await calendar.events.patch({
    calendarId: "primary",
    eventId,
    requestBody: updates,
  });

  return event.data;
}

export async function deleteCalendarEvent(clientId: string, eventId: string) {
  const calendar = await getCalendarClient(clientId);
  await calendar.events.delete({
    calendarId: "primary",
    eventId,
    sendUpdates: "all",
  });
}

export function getAuthUrl(clientId: string) {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    state: clientId,
    prompt: "consent",
  });
}

export async function handleOAuthCallback(code: string, clientId: string) {
  const { tokens } = await oauth2Client.getToken(code);
  
  const db = admin.firestore();
  // Corregido: Guardar en 'admins' en lugar de 'config'
  await db.collection("admins").doc(clientId).set({
    googleCalendar: { connected: true, connectedAt: new Date().toISOString() },
  }, { merge: true });

  await db.collection("admins").doc(clientId).update({
    "googleCalendar.tokens": tokens,
  });

  return tokens;
}

export async function isCalendarConnected(clientId: string): Promise<boolean> {
  try {
    const db = admin.firestore();
    // Corregido: Leer de 'admins' en lugar de 'config'
    const adminDoc = await db.collection("admins").doc(clientId).get();
    return !!adminDoc.data()?.googleCalendar?.tokens;
  } catch {
    return false;
  }
}
