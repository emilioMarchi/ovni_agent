import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import admin from "firebase-admin";

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  taskType: TaskType.RETRIEVAL_QUERY,
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Herramienta para búsqueda inteligente de productos.
 * Combina búsqueda semántica (Pinecone) con búsqueda de texto directo y filtrado por categoría.
 */
export const productCatalogTool = new DynamicStructuredTool({
  name: "product_catalog",
  description: "Busca productos, precios y disponibilidad en el catálogo del cliente.",
  schema: z.object({
    query: z.string().describe("Nombre o descripción del producto buscado."),
    clientId: z.string().describe("ID del cliente para filtrar por su catálogo."),
    allowedCategories: z.array(z.string()).optional().describe("Categorías permitidas para restringir la búsqueda."),
    listAll: z.boolean().optional().describe("Indica si debe listar todos los productos destacados sin filtrar por búsqueda semántica."),
  }),
  func: async ({ query, clientId, allowedCategories = [], listAll = false }) => {
    try {
      const db = admin.firestore();
      const index = pinecone.index("chatbot-knowledge");
      const namespace = `products_${clientId}`;
      let results: any[] = [];

      if (listAll || !query.trim()) {
        const snapshot = await db.collection("products")
          .where("clientId", "==", clientId)
          .limit(10)
          .get();
        results = snapshot.docs.map(doc => ({ id: doc.id, score: 1, ...doc.data() }));
      } else {
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
        
        let snapshot = await db.collection("products")
          .where("clientId", "==", clientId)
          .limit(20)
          .get();
        
        let results = snapshot.docs
          .map(doc => ({ id: doc.id, score: 0.5, ...doc.data() }))
          .filter(p => {
            const searchText = `${p.nombre} ${p.descripcion || ''} ${p.categoria || ''}`.toLowerCase();
            return queryWords.some(word => searchText.includes(word));
          })
          .map(p => ({ 
            ...p, 
            score: p.nombre?.toLowerCase().includes(queryWords[0]) ? 0.9 : 0.5 
          }));

        if (results.length === 0) {
          snapshot = await db.collection("products").limit(10).get();
          results = snapshot.docs
            .map(doc => ({ id: doc.id, score: 0.3, ...doc.data() }));
        }
      }

      // 3. Filtrado por categorías permitidas
      if (allowedCategories.length > 0) {
        results = results.filter(p => allowedCategories.includes(p.categoria));
      }

      // 4. Formatear salida
      if (results.length === 0) return "No se encontraron productos que coincidan con tu búsqueda.";

      return results
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 5)
        .map(p => {
          let display = `- ${p.nombre}`;
          if (p.precio && p.precio > 0) display += `: $${p.precio}`;
          if (p.categoria) display += ` (${p.categoria})`;
          if (p.sku) display += ` [Ref: ${p.sku}]`;
          return display;
        })
        .join("\n");

    } catch (error) {
      console.error("Error en product_catalog:", error);
      return "Hubo un error al consultar el catálogo de productos.";
    }
  },
});
