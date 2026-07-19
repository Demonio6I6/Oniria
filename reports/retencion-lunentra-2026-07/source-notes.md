# Notas de fuente y decisiones

## Trabajo de reporte

- Pregunta: qué función o sistema añadir para que Lunentra tenga un uso frecuente y una monetización coherente con el autoconocimiento.
- Audiencia: responsable de producto/fundador.
- Alcance: experiencia implementada en el repositorio al 16 de julio de 2026; no se evaluaron cohortes reales porque no hay exportación de analítica incluida en el proyecto.
- Comparación: bucle actual basado en sueños frente a opciones de contenido, check-in, microacciones, retos y comunidad.
- Criterio de éxito: crear un motivo frecuente y útil para volver, enriquecer los patrones personales y sostener una capa Premium diferenciada.

## Evidencia del repositorio

- `src/screens/Inicio.js`: CTA principal de sueño, objetivo mensual de 10 registros, primer indicio y accesos a diario/patrones.
- `src/screens/MainScreen.js`: emoción al despertar, contexto personal, guardado sin IA, resonancia y reflexión del usuario.
- `src/screens/DiagramaEmocional.js`: distribución emocional, mínimo de 10 sueños, Premium y enfriamiento de 30 días para análisis profundo.
- `src/screens/PlanPremium.js`: propuesta actual de 15 lecturas mensuales, ampliación, análisis mensual y diario manual.
- `functions/index.js`: límites de acceso, catálogo de eventos de producto y notificación diaria compartida.
- `functions/openai.js`: interpretación prudente, análisis mensual y generación de una reflexión general diaria.

## Fuentes externas

- Daylio, sitio oficial: registro en dos toques, actividades, correlaciones, metas y recordatorios.
- How We Feel, ficha oficial en App Store: check-ins diarios, tendencias de salud y estrategias emocionales breves.
- JMIR, revisión sistemática de adherencia en mHealth: personalización, notificaciones individualizadas, autoobservación, visualización y facilidad de uso como factores asociados a adherencia.

## Criterios de priorización

1. Frecuencia natural del disparador.
2. Valor inmediato para el usuario.
3. Datos que mejoran la promesa central de patrones personales.
4. Diferenciación frente a contenido genérico y mood trackers.
5. Riesgo de confianza, privacidad y seguridad.
6. Capacidad de sostener una propuesta Premium.

Las valoraciones Alto/Medio/Bajo son juicio de producto, no métricas observadas.

## Estructura del informe

- Title: bloque `title`.
- Executive Summary: bloque `executive_summary`.
- Key findings with visual evidence: secciones `current_finding`, `recommended_finding`, `market_evidence` y `options_finding`, acompañadas por tres tablas.
- Recommended next steps: secciones `monetization`, `mvp` y `measurement`.
- Further questions: bloque `further_questions`.
- Caveats and assumptions: bloque `caveats`.

## Mapa y límites de visualización

- Sección: comparación de opciones de retención.
- Pregunta: qué opción supera más filtros necesarios para el siguiente bucle de producto.
- Familia y tipo: comparación; barras horizontales.
- Campos: `option` y `fit_score`; el tooltip conserva los filtros superados y la decisión.
- Fuente: síntesis cualitativa documentada en estas notas.
- Escala: 0–4, un punto por disparador frecuente, aprendizaje del núcleo, diferenciación y riesgo aceptable.
- Paleta: una raíz azul secuencial, sin leyenda redundante.

No se incluyeron gráficos de frecuencia, retención, cohortes o conversión porque el repositorio no aporta esos datos reales. La puntuación visible se presenta explícitamente como cribado de producto, no como medición de usuarios, y la tabla conserva los matices que la barra resume.
