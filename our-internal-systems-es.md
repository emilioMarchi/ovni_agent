# Nuestros Sistemas Internos

Además de las aplicaciones orientadas al cliente, como las diferentes versiones de Basecamp, tenemos una serie de sistemas internos que nos ayudan a dar soporte, reportar y operar la empresa. Son los siguientes:

## Queenbee

Queenbee es nuestro sistema de facturación, contabilidad e identidad. Aquí puedes buscar cualquier cuenta de cliente, ver si tiene beneficios, reembolsar una factura o incluso iniciar sesión como cliente.

Eso implica un inmenso poder y nos tomamos su uso muy en serio. Solo iniciamos sesión como cliente después de haber recibido permiso explícito para hacerlo, nunca de forma preventiva. Nuestros clientes esperan que su información sea confidencial, incluso para nosotros, y tenemos la intención de respetar esa expectativa en todo momento.

[billing.37signals.com 🔒](https://billing.37signals.com)

## Sentry

Registramos las excepciones de programación en Sentry. Cuando un cliente ve una pantalla de “¡Ups, algo salió mal!”, eso significa que habrá una entrada en Sentry explicando a los programadores por qué vieron esa pantalla. Mantener las excepciones bajo control y monitoreadas es principalmente responsabilidad del equipo SIP y Jim mediante guardias.

[getsentry.com](https://getsentry.com)

## Grafana

Monitoreamos nuestros sistemas y su salud a través de Grafana. Aquí encontrarás tableros y reglas de alertas. Es nuestra herramienta principal para diagnosticar problemas de rendimiento, caídas y cualquier otro tipo de información operativa.

[grafana.37signals.com 🔒](https://grafana.37signals.com/)

## Dash

Dash es el centro principal para todo lo relacionado con logs (como encontrar por qué una solicitud es lenta o si un correo fue entregado), reportes (desde el número de casos de soporte atendidos hasta el desglose de dispositivos usados para acceder a Basecamp), salud de la aplicación (tiempos de respuesta, excepciones en la cola de trabajos, etc).

[dash.37signals.com 🔒](https://dash.37signals.com)

## Omarchy

[Omarchy](https://omarchy.org) es nuestra nueva distribución de Linux a la que todos en Operaciones, SIP y los programadores Ruby de Producto se están migrando. La desarrollamos internamente y seguimos liderando su desarrollo.

## Kandji

[Kandji](https://kandji.io) es como nos aseguramos de que todas las Mac de trabajo estén configuradas de forma segura y ejecutando las últimas actualizaciones de software. Nos ayuda a reducir la exposición a incidentes de seguridad. Puedes leer más sobre esto en [Gestionando dispositivos de trabajo](https://github.com/basecamp/handbook/blob/master/managing-work-devices.md).

## Shipshape

Shipshape es la herramienta interna original para asegurar que tu Mac de trabajo esté segura. Todavía la usamos, pero está siendo reemplazada gradualmente por Kandji. Cuando te dan acceso a la cuenta de GitHub de la empresa, puedes ejecutar Shipshape para asegurarte de que todo esté en regla. Shipshape también probará tu máquina periódicamente para avisarte (y al equipo SIP) si tu máquina tiene algún problema y necesita atención.

[github.com/basecamp/shipshape 🔒](https://github.com/basecamp/shipshape)
