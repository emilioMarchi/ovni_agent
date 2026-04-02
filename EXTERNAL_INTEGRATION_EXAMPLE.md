# Ejemplo de Integración Externa con la API de Ovni Agent

Este ejemplo muestra cómo un CRM, sitio o servicio externo puede integrarse con tu API para operar con su propio agente y documentos.

---

## 1. Alta de usuario externo (admin/cliente)

- Desde el admin UI, crea un nuevo usuario (admin) para el cliente externo.
- Obtén el `clientId` generado (lo ves en la UI o vía endpoint de admins).

## 2. Creación de agente propio

- Desde el admin UI, crea un agente asociado a ese `clientId`.
- Obtén el `agentId` generado.

## 3. Obtención de token de acceso

- Desde la UI o endpoint de autenticación, genera un token JWT/API KEY para el usuario externo.
- El token se usará en el header Authorization: `Bearer <token>`.

## 4. Subida de documentos propios

```http
POST /api/documents/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

Campos:
- file: archivo (pdf, docx, xlsx, json, txt, md, csv, doc, xls)
- description: (opcional)
- keywords: (opcional)
- docType: reference | contract
- clientId: <clientId>
```

## 5. Uso del agente vía API (chat)

```http
POST /api/agents/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "clientId": "<clientId>",
  "agentId": "<agentId>",
  "messages": [
    { "role": "user", "content": "Hola, ¿qué documentos tengo?" }
  ]
}
```

## 6. Listar documentos

```http
GET /api/documents?clientId=<clientId>
Authorization: Bearer <token>
```

## 7. Seguridad y separación

- Cada cliente externo solo accede a sus agentes y documentos (filtrado por `clientId`).
- El token de acceso es obligatorio y se valida en cada request.
- Puedes revocar o regenerar tokens desde el admin UI.

---

## Recomendación para mejores resultados de análisis

Al solicitar un análisis documental, es fundamental que el usuario sea lo más claro y específico posible en su consulta. El sistema utiliza el texto de la consulta para guiar la búsqueda y el análisis, por lo que instrucciones detalladas (por ejemplo: "buscar cláusulas de rescisión anticipada" o "comparar tasas de interés entre contratos") permiten obtener reportes más relevantes y precisos.

**Sugerencia:** Siempre especifica qué aspectos, temas o riesgos deseas analizar en los documentos. Esto mejora la cobertura y utilidad del análisis generado por el agente.

---

**¿Dudas o necesitas un ejemplo en otro lenguaje? Pedilo.**
