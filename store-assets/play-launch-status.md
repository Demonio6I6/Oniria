# Estado de lanzamiento de Lunentra en Google Play

Última revisión: 22 de julio de 2026.

## Preparado y comprobado

- Proyecto Android actualizado a Expo SDK 54, React Native 0.81 y API de destino/compilación 36.
- Nueva arquitectura y Hermes activos; dependencias nativas alineadas con Expo.
- Exportación Android de JavaScript completada y Expo Doctor aprobado (17/17).
- Firebase Functions (14 funciones), reglas de Firestore y Hosting desplegados.
- Política de privacidad, términos y eliminación de cuenta publicados con respuesta HTTP 200.
- Google, correo y acceso anónimo habilitados en Firebase Authentication.
- RevenueCat conectado con Google Play, credenciales de servicio válidas, notificaciones en tiempo real activas, productos mensual/anual vinculados, entitlement `Premium` y webhook de Firebase activo.
- Icono de 512 × 512, gráfico de funciones de 1024 × 500, textos de ficha y borrador de Seguridad de los datos preparados en `store-assets/`.
- Función interna para denunciar respuestas de IA añadida, con almacenamiento privado, límite antiabuso y borrado asociado a la eliminación de la cuenta.
- Compilación AAB de producción código 6 solicitada en EAS: `ed89360b-d2aa-447b-a723-8146b63802c9`. Se inició antes de añadir el reporte obligatorio de IA y no debe enviarse a producción.
- La compilación código 7 (`56876a0e-dfc3-4a7d-9e4f-077335207855`) falló al instalar dependencias porque `package-lock.json` no incluía dos paquetes de desarrollo. El lockfile quedó sincronizado y `npm ci --include=dev --dry-run` termina correctamente.
- Nueva compilación AAB de producción código 8 aceptada por EAS y en cola: `5104fbee-cb3b-466a-9c0e-58245bf85bd2`.
- Las cuatro huellas SHA-1/SHA-256 de firma de Play y del certificado de subida están registradas en la aplicación Android de Firebase.
- Las 10 declaraciones de contenido de Google Play están completadas: privacidad, anuncios, acceso de revisión, IARC, audiencia, seguridad de los datos, ID de publicidad, administración pública, funciones financieras y salud.
- Categoría `Estilo de vida`, correo de soporte y sitio web públicos guardados en Google Play.
- Cuenta dedicada de revisión creada y habilitada con acceso Premium en producción. Las credenciales no se guardan en el repositorio.
- Nombre y descripciones de la ficha principal guardados como borrador en Google Play.
- Icono y gráfico de funciones subidos, asociados y guardados en el borrador de la ficha de Google Play.

## Configuración de firma en Firebase

Registradas en la aplicación Android de Firebase:

- Firma de aplicaciones de Play, SHA-1: `AD:F8:D7:26:15:8C:4E:9A:49:6F:4E:74:27:66:E4:F7:B3:6A:B0:E7`
- Firma de aplicaciones de Play, SHA-256: `F8:FF:61:AC:B0:F7:29:02:3F:2F:46:81:7A:85:76:30:FA:87:A3:EF:B1:DB:21:63:E8:77:92:13:C1:9D:18:93`
- Certificado de subida, SHA-1: `83:AC:DA:AE:A0:CC:22:E4:96:26:76:7A:F8:9A:F3:71:19:F8:5B:45`
- Certificado de subida, SHA-256: `37:34:57:F9:CF:E2:0F:64:4F:8C:63:81:C2:99:2F:CE:E7:46:9B:8B:65:2D:45:AA:36:D0:1C:9B:2C:33:03:77`

La descarga del `google-services.json` actualizado no pudo completarse porque la sesión de Firebase CLI caducó. El registro de las huellas sí está aplicado en el servidor y la aplicación ya configura explícitamente el ID de cliente web; conviene refrescar el archivo antes de la versión final, aunque no bloquea esta compilación de prueba.

## Declaraciones aplicadas en Google Play

- Política de privacidad: `https://post-it-72f0b.web.app/privacy`
- Contiene anuncios: No.
- ID de publicidad: No.
- Aplicación gubernamental: No.
- Funciones financieras: Ninguna.
- Salud: `Gestión del estrés, relajación y agudeza mental`; bienestar/reflexión, no funcionalidad médica ni diagnóstico.
- Audiencia: 16–17 y 18 o más; no dirigida a niños.
- Categoría de la tienda: Estilo de vida.
- Acceso restringido: Sí; cuenta estable de revisión con acceso Premium e instrucciones registrada.
- Clasificación IARC completada: ClassInd 14+, ESRB Everyone, PEGI 3, USK para todos y clasificación genérica 3+; incluye descriptor de compras dentro de la aplicación.
- Seguridad de los datos completada de acuerdo con `store-assets/play-data-safety-es.md`.

## Bloqueos que requieren intervención o tiempo real

1. **AAB:** esperar a que EAS termine el artefacto código 8, descargarlo y subirlo a una prueba cerrada de Google Play.
2. **Capturas:** obtener al menos dos capturas reales de teléfono o tablet, sin datos personales. No deben sustituirse por imágenes generadas. Para una ficha adecuada se priorizan capturas de teléfono; las secciones de tablet de 7 y 10 pulgadas siguen disponibles.
3. **Compra completa:** realizar una compra de prueba desde una versión distribuida por Play y confirmar Google Play → RevenueCat → webhook → Firebase → app.
4. **Prueba cerrada obligatoria:** incorporar al menos 12 cuentas de Google y mantenerlas inscritas durante 14 días consecutivos antes de solicitar acceso a producción.
5. **Revisión de Google:** tras cumplir la prueba cerrada, solicitar acceso a producción y posteriormente enviar la versión pública a revisión.

## Criterio de “lista para mercado”

Lunentra estará técnicamente lista para solicitar producción cuando el AAB código 8 o superior esté aceptado, el acceso con Google y las compras hayan pasado pruebas reales, la ficha tenga gráficos y capturas válidas, y la prueba cerrada de 12 personas durante 14 días haya finalizado.
