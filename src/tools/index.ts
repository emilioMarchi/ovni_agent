import { knowledgeRetrieverTool } from "./knowledge_retriever.js";
import { productCatalogTool } from "./product_catalog.js";
import { userProfileManagerTool } from "./user_profile_manager.js";
import { commsSenderTool } from "./comms_sender.js";
import { appointmentManagerTool } from "./appointment_manager.js";
import { historyRetrieverTool } from "./history_retriever.js";

/**
 * Catálogo completo de herramientas disponibles para el Agente OVNI v2.
 */
export const tools = [
  knowledgeRetrieverTool,
  productCatalogTool,
  userProfileManagerTool,
  commsSenderTool,
  appointmentManagerTool,
  historyRetrieverTool,
];

// Re-exportar herramientas individuales
export {
  knowledgeRetrieverTool,
  productCatalogTool,
  userProfileManagerTool,
  commsSenderTool,
  appointmentManagerTool,
  historyRetrieverTool,
};
