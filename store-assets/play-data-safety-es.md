# Borrador de Seguridad de los datos de Google Play

Preparado a partir del comportamiento de la versión Android 1.0.0 (código 6). Debe revisarse de nuevo si cambian los SDK, el almacenamiento, la analítica o la política del proveedor de IA.

## Recogida y seguridad

- ¿La aplicación recoge o comparte tipos de datos obligatorios?: **Sí**.
- ¿Todos los datos recogidos se cifran en tránsito?: **Sí** (HTTPS/TLS).
- ¿Se puede solicitar la eliminación de los datos?: **Sí**; desde la aplicación y en `https://post-it-72f0b.web.app/delete-account`.
- ¿Se comparten datos con terceros?: **No**, tratando Firebase/Google Cloud, OpenAI, RevenueCat y Expo como proveedores que procesan por cuenta de Nicarao, y el envío a IA como una acción iniciada por el usuario con aviso y consentimiento destacado. Esta respuesta debe mantenerse solo mientras los contratos y la configuración real de esos proveedores sigan cumpliendo las excepciones de Google Play.

## Tipos de datos que se deben seleccionar

| Categoría | Tipo | Recogido | Compartido | Efímero | Obligatorio | Finalidad |
|---|---|---:|---:|---:|---:|---|
| Información personal | Nombre | Sí | No | No | No | Funcionalidad de la app; gestión de cuentas |
| Información personal | Dirección de correo electrónico | Sí | No | No | No | Funcionalidad de la app; gestión de cuentas; seguridad y prevención del fraude |
| Información personal | IDs de usuario | Sí | No | No | Sí | Funcionalidad de la app; gestión de cuentas; analítica; seguridad y prevención del fraude |
| Información personal | Otra información | Sí | No | No | No | Funcionalidad de la app; personalización |
| Información financiera | Historial de compras | Sí | No | No | Sí | Funcionalidad de la app; analítica |
| Salud y actividad física | Información de salud | Sí | No | No | No | Funcionalidad de la app; personalización |
| Actividad en la aplicación | Interacciones con la aplicación | Sí | No | No | Sí | Analítica |
| Actividad en la aplicación | Otro contenido generado por el usuario | Sí | No | No | No | Funcionalidad de la app; personalización |
| Dispositivo u otros IDs | Dispositivo u otros IDs | Sí | No | No | Sí | Funcionalidad de la app; seguridad y prevención del fraude; comunicaciones del desarrollador |

## Justificación por tipo

- **Nombre y correo:** Firebase Authentication los conserva cuando el usuario elige Google o correo. Son opcionales porque existe el modo invitado.
- **IDs de usuario:** Firebase UID, ID de instalación y el mismo UID usado como identificador de RevenueCat. Se utilizan para autenticar, aplicar cuotas, sincronizar Premium y asociar eventos operativos.
- **Otra información e información de salud:** las respuestas opcionales del perfil pueden contener relaciones, historia personal, emociones, estrés o ansiedad. Solo salen del dispositivo cuando el usuario acepta solicitar una lectura de IA.
- **Historial de compras:** RevenueCat y el servidor procesan producto, estado y vigencia de la suscripción. RevenueCat indica que este tipo es obligatorio y que sus finalidades son funcionalidad y analítica.
- **Interacciones:** se guardan eventos limitados como apertura del paywall, inicio/resultado de compra, uso de una lectura o guardado de una reflexión. No incluyen el texto del sueño.
- **Otro contenido generado por el usuario:** texto del sueño, asociaciones y contexto enviados voluntariamente para una lectura, además de la respuesta de IA y el motivo enviados al denunciarla. El diario que nunca se envía y permanece cifrado en el dispositivo queda fuera del alcance de la declaración.
- **Dispositivo u otros IDs:** ID de instalación para límites y prevención de abuso, y token de notificación solo cuando el usuario activa recordatorios.

## Tipos que no se deben seleccionar para esta versión

- Ubicación aproximada o precisa.
- Información de pago o tarjeta; la recoge Google Play directamente y Lunentra no accede a ella.
- Número de teléfono; la versión 6 ya no ofrece autenticación por SMS.
- Fotos, vídeos, audio, archivos, calendario, contactos, mensajes, historial web o aplicaciones instaladas.
- Registros de fallos o diagnósticos: no hay un SDK de crash reporting o rendimiento configurado en esta versión.
- ID de publicidad: la aplicación no declara `com.google.android.gms.permission.AD_ID` ni integra publicidad.

## Decisiones conservadoras

- **Información de salud:** se declara porque el formulario del perfil pregunta expresamente por estrés, ansiedad y estado emocional, aunque Lunentra sea bienestar y no un producto médico.
- **Procesamiento efímero:** se responde **No** para el contenido enviado a IA. El servidor de Lunentra no conserva el texto del sueño, pero no se debe afirmar procesamiento exclusivamente en memoria mientras no exista una garantía comprobada de retención cero del proveedor.

## Fuentes de referencia

- Google Play, Seguridad de los datos: https://support.google.com/googleplay/android-developer/answer/10787469
- Google Play, declaración de aplicaciones de salud: https://support.google.com/googleplay/android-developer/answer/14738291
- RevenueCat, Seguridad de los datos de Google Play: https://www.revenuecat.com/docs/platform-resources/google-platform-resources/google-plays-data-safety
