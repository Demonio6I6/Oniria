# Biblioteca de conocimiento de Lunentra

Esta carpeta es para textos fuente que puedan usarse mas adelante en una capa
RAG o vector store. La app movil no deberia cargar PDFs completos ni libros
grandes en el bundle: aumenta el peso de instalacion y hace mas dificil citar
o recuperar fragmentos concretos.

## Formato recomendado

- Preferido: `.txt` o `.md` en UTF-8, con capitulos y secciones claras.
- Aceptable para ingesta en servidor: `.pdf`, si antes se extrae y revisa el
  texto.
- Evitar en el bundle movil: PDFs escaneados, imagenes pesadas o libros sin
  licencia clara.

## Donde colocarlos

Coloca los textos originales o limpios en `knowledge/sources/`. Cuando se
implemente RAG, el servidor o una tarea de ingestion deberia leer esa carpeta,
crear embeddings/vector store y guardar solo metadatos en la app.

## Fuentes sugeridas para empezar

- Sigmund Freud, `The Interpretation of Dreams`, Project Gutenberg.
- Sigmund Freud, `Dream Psychology: Psychoanalysis for Beginners`, Project
  Gutenberg.
- Articulos open access del `International Journal of Dream Research`, revisando
  la licencia de cada articulo antes de incluirlo.

## Criterio de producto

Estas fuentes deben servir como contexto orientativo y bibliografico. La app no
debe presentar sus respuestas como diagnostico clinico ni afirmar que un simbolo
significa siempre lo mismo para todos los usuarios.
