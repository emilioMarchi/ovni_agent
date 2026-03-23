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
}

router.post("/invoke", async (req: Request, res: Response) => {
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

    console.log(`📨 Invocando agente ${agentId} para cliente ${clientId}`);

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
      .collection("conversations")
      .doc(threadId)
      .collection("messages")
      .orderBy("createdAt", "asc")
      .get();

    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ success: false, error: "Error al obtener historial" });
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
    }));

    res.json({ success: true, data: agents });
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).json({ success: false, error: "Error al obtener agentes" });
  }
});

export default router;
