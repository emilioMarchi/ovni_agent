import { Router, Request, Response } from "express";
import { getAuthUrl, handleOAuthCallback, createCalendarEvent, isCalendarConnected } from "../../services/calendarService.js";
import admin from "../firebase.js";
import { sendMeetingConfirmationToUser, sendMeetingCancellationToUser } from "../../services/emailService.js";

const router = Router();

router.get("/google-calendar/connect", (req: Request, res: Response) => {
  const clientId = req.headers["x-client-id"] as string;
  
  if (!clientId) {
    return res.status(401).json({ success: false, error: "Client ID requerido" });
  }

  const authUrl = getAuthUrl(clientId);
  res.json({ success: true, authUrl });
});

router.get("/google-calendar/callback", async (req: Request, res: Response) => {
  const { code, state: clientId } = req.query;

  if (!code || !clientId) {
    return res.status(400).json({ success: false, error: "Código o clientId faltante" });
  }

  try {
    await handleOAuthCallback(code as string, clientId as string);
    res.json({ success: true, message: "Google Calendar conectado exitosamente" });
  } catch (error: any) {
    console.error("Error en OAuth callback:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/status", async (req: Request, res: Response) => {
  const clientId = req.headers["x-client-id"] as string;
  
  if (!clientId) {
    return res.status(401).json({ success: false, error: "Client ID requerido" });
  }

  try {
    const db = admin.firestore();
    const adminDoc = await db.collection("admins").doc(clientId).get();
    const calendarConnected = !!adminDoc.data()?.googleCalendar?.tokens;

    res.json({
      success: true,
      data: {
        calendarConnected,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.all("/:meetingId/confirm", async (req: Request, res: Response) => {
  try {
    const { meetingId } = req.params;
    const db = admin.firestore();

    const meetingRef = db.collection("meetings").doc(meetingId);
    const meetingDoc = await meetingRef.get();

    if (!meetingDoc.exists) {
      return res.status(404).json({ success: false, error: "Reunión no encontrada" });
    }

    const meetingData = meetingDoc.data()!;
    const clientId = meetingData.clientId;

    let calendarEventId = meetingData.calendarEventId || null;

    const calendarConnected = await isCalendarConnected(clientId);
    console.log(`📅 [CALENDAR] Status confirmación ${meetingId} - ClientId: ${clientId} | Conectado: ${calendarConnected} | EventoExistente: ${calendarEventId}`);

    if (calendarConnected && !calendarEventId) {
      try {
        console.log(`📅 [CALENDAR] Iniciando creación de evento en Google Calendar...`);
        const event = await createCalendarEvent(clientId, {
          date: meetingData.date,
          time: meetingData.time,
          customerName: meetingData.customerName,
          customerEmail: meetingData.customerEmail,
          customerPhone: meetingData.customerPhone,
          topic: meetingData.topic,
          status: "confirmed",
        });
        console.log(`✅ [CALENDAR] Evento creado con éxito. Google ID: ${event.id}`);
        console.log(`🔗 [CALENDAR] Link: ${event.htmlLink}`);
        
        calendarEventId = event.id || null;
        meetingData.eventLink = event.htmlLink; 
      } catch (calError: any) {
        console.error("❌ [CALENDAR] ERROR AL CREAR EVENTO:", calError.message);
        if (calError.response) {
            console.error("❌ [CALENDAR] Data error API:", JSON.stringify(calError.response.data));
        }
      }
    } else {
        if (!calendarConnected) console.warn(`⚠️ [CALENDAR] OMITIDO: El calendario NO está conectado para el cliente ${clientId}.`);
        if (calendarEventId) console.warn(`⚠️ [CALENDAR] OMITIDO: La reunión ya tiene un evento asociado (ID: ${calendarEventId}).`);
    }

    await meetingRef.update({
      status: "confirmed",
      confirmedAt: new Date().toISOString(),
      calendarEventId,
    });

    try {
      await sendMeetingConfirmationToUser(meetingData.customerEmail, {
        customerName: meetingData.customerName,
        date: meetingData.date,
        time: meetingData.time,
        topic: meetingData.topic,
        eventLink: meetingData.eventLink, // Pasar el eventLink a la función de envío de correo
      });
    } catch (e) {
      console.warn("No se pudo enviar email de confirmación:", e);
    }

    res.send(`<h1>Reunión Confirmada</h1><p>La reunión ha sido confirmada correctamente y se ha enviado la notificación al cliente.</p>`);
  } catch (error: any) {
    console.error("Error confirmando reunión:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.all("/:meetingId/reject", async (req: Request, res: Response) => {
  try {
    const { meetingId } = req.params;
    const db = admin.firestore();

    const meetingRef = db.collection("meetings").doc(meetingId);
    const meetingDoc = await meetingRef.get();

    if (!meetingDoc.exists) {
      return res.status(404).json({ success: false, error: "Reunión no encontrada" });
    }

    const meetingData = meetingDoc.data()!;

    await meetingRef.update({
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    });

    try {
      await sendMeetingCancellationToUser(meetingData.customerEmail, {
        customerName: meetingData.customerName,
        date: meetingData.date,
        time: meetingData.time,
      });
    } catch (e) {
      console.warn("No se pudo enviar email de cancelación:", e);
    }

    res.send(`<h1>Reunión Cancelada</h1><p>La reunión ha sido cancelada correctamente.</p>`);
  } catch (error: any) {
    console.error("Error cancelando reunión:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
