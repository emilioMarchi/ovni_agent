import { Router, Request, Response } from "express";
import { graph } from "../../graph/index.js";
import admin from "../firebase.js";

const router = Router();
const db = admin.firestore();

interface ChatRequest {
  agentId: string;
  message: string;
  threadId?: string;
  clientId?: string;
  metadata?: Record<string, unknown>;
  endSession?: boolean;
}

router.post("/invoke", async (req: Request, res: Response) => {
  try {
    const { agentId, message, threadId, clientId: bodyClientId, endSession } = req.body as ChatRequest;

    if (!agentId || !message) {
      return res.status(400).json({ 
        success: false, 
        error: "agentId y message son requeridos" 
      });
    }

    let clientId = bodyClientId || "";
    
    if (!clientId && agentId) {
      try {
        const agentDoc = await db.collection("agents").doc(agentId).get();
        if (agentDoc.exists) {
          clientId = agentDoc.data()?.clientId || "";
        }
      } catch (e) {
        console.error("Error getting agent clientId:", e);
      }
    }

    const config = {
      configurable: {
        thread_id: threadId || crypto.randomUUID(),
        agentId,
        clientId: clientId || "unknown",
      },
    };

    const inputState = {
      messages: [{ role: "user", content: message }],
      agentId,
      clientId: clientId || "unknown",
      threadId: threadId || crypto.randomUUID(),
      endSession: endSession || false,
    };

    console.log(`📨 Invocando agente ${agentId} para cliente ${clientId}${endSession ? ' (FIN DE SESIÓN)' : ''}`);

    const result = await graph.invoke(inputState, config);

    const lastMessage = result.messages[result.messages.length - 1];
    
    res.json({ 
      success: true, 
      data: {
        response: lastMessage.content,
        threadId: config.configurable.thread_id,
      }
    });
  } catch (error) {
    console.error("Error invoking agent:", error);
    res.status(500).json({ success: false, error: "Error al invocar agente" });
  }
});

router.post("/stream", async (req: Request, res: Response) => {
  try {
    const { agentId, message, threadId, clientId: bodyClientId } = req.body as ChatRequest;

    if (!agentId || !message) {
      return res.status(400).json({ 
        success: false, 
        error: "agentId y message son requeridos" 
      });
    }

    let clientId = bodyClientId || "";
    
    if (!clientId && agentId) {
      try {
        const agentDoc = await db.collection("agents").doc(agentId).get();
        if (agentDoc.exists) {
          clientId = agentDoc.data()?.clientId || "";
        }
      } catch (e) {
        console.error("Error getting agent clientId:", e);
      }
    }

    const config = {
      configurable: {
        thread_id: threadId || crypto.randomUUID(),
        agentId,
        clientId: clientId || "unknown",
      },
    };

    const inputState = {
      messages: [{ role: "user", content: message }],
      agentId,
      clientId: clientId || "unknown",
      threadId: threadId || crypto.randomUUID(),
    };

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    for await (const chunk of await graph.stream(inputState, config)) {
      if (chunk.agent?.messages) {
        const lastMsg = chunk.agent.messages[chunk.agent.messages.length - 1];
        if (lastMsg.content) {
          fullResponse += lastMsg.content;
          res.write(`data: ${JSON.stringify({ type: "chunk", content: lastMsg.content })}\n\n`);
        }
      }
    }

    res.write(`data: ${JSON.stringify({ type: "done", content: fullResponse })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Error streaming from agent:", error);
    res.status(500).json({ success: false, error: "Error al hacer stream del agente" });
  }
});

router.get("/history/:threadId", async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    
    const snapshot = await db
      .collection("history")
      .where("threadId", "==", threadId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.json({ success: true, data: [] });
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    const messages = data.messages || [];
    
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ success: false, error: "Error al obtener historial" });
  }
});

router.get("/sessions", async (req: Request, res: Response) => {
  try {
    const { clientId, agentId, limit = "20" } = req.query;
    
    if (!clientId) {
      return res.status(400).json({ success: false, error: "clientId es requerido" });
    }

    let snapshot;
    
    if (agentId) {
      snapshot = await db.collection("history")
        .where("clientId", "==", clientId as string)
        .where("agentId", "==", agentId as string)
        .limit(parseInt(limit as string))
        .get();
    } else {
      snapshot = await db.collection("history")
        .where("clientId", "==", clientId as string)
        .limit(parseInt(limit as string))
        .get();
    }

    const sessions = await Promise.all(snapshot.docs.map(async doc => {
      const data = doc.data();
      
      let userName = data.userName || null;
      
      if (!userName && data.userId && data.userId !== 'anonymous') {
        try {
          const userDoc = await db.collection("users").doc(`${data.clientId}_${data.userId}`).get();
          if (userDoc.exists) {
            userName = userDoc.data()?.name || null;
          }
        } catch (e) {
          console.log('Error fetching user name:', e);
        }
      }

      const displayName = userName || (data.threadId ? `Usuario-${data.threadId.slice(0, 8)}` : 'Anónimo');
      
      return {
        threadId: data.threadId,
        agentId: data.agentId,
        userId: data.userId,
        userName: displayName,
        lastUpdate: data.lastUpdate?.toDate?.() ? data.lastUpdate.toDate().toISOString() : null,
        messageCount: data.messages?.length || 0,
        summary: data.summary,
        classification: data.classification,
      };
    }));

    sessions.sort((a, b) => {
      const dateA = a.lastUpdate ? new Date(a.lastUpdate).getTime() : 0;
      const dateB = b.lastUpdate ? new Date(b.lastUpdate).getTime() : 0;
      return dateB - dateA;
    });

    res.json({ success: true, data: sessions });
  } catch (error: any) {
    console.error("Error fetching sessions:", error?.message || error);
    res.status(500).json({ success: false, error: "Error al obtener sesiones: " + (error?.message || error) });
  }
});

router.get("/sessions/:threadId", async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    
    const snapshot = await db
      .collection("history")
      .where("threadId", "==", threadId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ success: false, error: "Sesión no encontrada" });
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    res.json({
      success: true,
      data: {
        threadId: data.threadId,
        clientId: data.clientId,
        agentId: data.agentId,
        userId: data.userId,
        userName: data.userName || null,
        messages: data.messages,
        summary: data.summary,
        classification: data.classification,
        lastUpdate: data.lastUpdate?.toDate?.() ? data.lastUpdate.toDate().toISOString() : null,
      }
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    res.status(500).json({ success: false, error: "Error al obtener sesión" });
  }
});

router.get("/agents", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.query;
    
    if (!clientId) {
      return res.status(400).json({ success: false, error: "clientId es requerido" });
    }

    const snapshot = await db
      .collection("agents")
      .where("clientId", "==", clientId)
      .where("active", "==", true)
      .get();

    const agents = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
      description: doc.data().description,
      welcomeMessage: doc.data().welcomeMessage,
    }));

    res.json({ success: true, data: agents });
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).json({ success: false, error: "Error al obtener agentes" });
  }
});

export default router;
