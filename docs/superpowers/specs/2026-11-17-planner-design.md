# Planner de recetas - diseño

## Intención
Organizar lo que se cocina durante el mes: crear/editar recetas, ponerlas en días con hora, ver ingredientes y lista de compras, y cocinar paso a paso con temporizadores. Funciona en PC y Android. Permite cargar recetas (y plan) generados por una IA mediante JSON.

## Metas
- Simple, minimalista, detallado y confiable.
- Offline, sin cuentas, sin servidor.
- Importar JSON de IA validado y tolerante.

## No-metas (por ahora)
- Nube/sincronización entre dispositivos (siguiente fase).
- Conversión de unidades, inventario de despensa.

## Enfoque elegido
PWA en HTML/CSS/JS puro (sin build), datos en localStorage, instalable en Android.
Alternativas descartadas: framework + build (más peso sin necesidad); app nativa (no portable a PC); nube ya (el usuario prefiere sin nube ahora).
Preparado para la nube: toda la persistencia pasa por `Store.load()/save()` (async); los datos llevan `updatedAt`. Para añadir nube se sustituye `Store`.

## Modelo de datos
`{version, updatedAt, recipes:[{id,name,description,servings,prepMinutes,cookMinutes,tags,ingredients:[{name,qty,unit}],steps:[{text,timer}],notes}], plan:{"YYYY-MM-DD":[{id,recipeId,time,servings,done}]}, shop:{checked:{},extra:[]}}`

## Pantallas
Calendario mensual -> Día (platos con hora/porciones) · Recetas (lista, editor, importar IA) · Compras (rango de fechas, agregada y escalada por porciones) · Cocinar (pasos, temporizadores múltiples con alarma/vibración/notificación) · Datos (respaldo JSON, prompt para IA).

## Formato IA
`{"schema":"planner/2","recipes":[...],"plan":[{"date","recipe","meal","time","servings"}]}`; el importador acepta también una receta suelta o un arreglo, alias en español, y limpia bloques ```json.

## Versión 2 (interfaz detallada + recetario)
- Navegación: Hoy · Mes · Recetario · Compras · Más (barra lateral en PC, pestañas abajo en móvil).
- Día organizado por franjas de comida (desayuno, almuerzo, merienda, cena); cada franja tiene "+ Añadir", que abre el selector del recetario (añadir con un toque, varias a la vez) o crea una receta nueva que se añade al día al guardarla.
- Recetario: tarjetas con "plato" (emoji sobre círculo del color de la comida), filtros por categoría/favoritas, orden, detalle con porciones escalables y "En tu plan".
- Recetas con categoría, dificultad, emoji y favorita. Plan con `meal`. 12 recetas de ejemplo en el primer arranque.
- Compras agrupadas por pasillo, con progreso y compartir.
- Cocinar: lista de ingredientes marcable, lista de pasos navegable, temporizador sugerido si el texto menciona minutos; al terminar marca el platillo como hecho.
- Paleta "huerto" (albahaca, azafrán, tomate) y tipografías Bricolage Grotesque + Atkinson Hyperlegible.

## Versión 3 (edición, temporizador circular, listas, organizar el mes)
- Recetario: modo "Organizar" con selección múltiple (cambiar categoría, favoritas, eliminar), botón editar en cada tarjeta y eliminar desde el editor.
- Temporizador estilo reloj: anillo que se vacía, pausa/reanudar/reiniciar/+1:00, al terminar el anillo late en rojo y cuenta en negativo. Panel "Temporizadores" con tiempos rápidos y personalizado (min/seg). En modo cocinar se ven los anillos debajo del paso.
- Compras: varias listas (`lists[]`), creadas desde el plan (rango de fechas) o vacías. Artículos editables (nombre, cantidad, unidad, pasillo), añadir a mano, renombrar, duplicar, eliminar, "Actualizar desde el plan" (no pisa lo editado ni recupera lo borrado). Datos antiguos `shop.extra` migran a "Mi lista".
- Calendario: "Organizar el mes" arma el plan con recetas del recetario (fechas, comidas, todas o favoritas, días sin repetir, respetar lo ya planificado, vista previa y mezclar), o importa un calendario JSON `{"plan":[{date,recipe,meal,time,servings}]}` con prompt que incluye los nombres de tus recetas. Botón "Deshacer" tras aplicar.

## Prompt nutricional (Organizar el mes, Importar calendario)
- Perfil guardado en `profile` (sexo, edad, peso opcional, actividad, objetivo, restricciones, porciones). Por defecto: mujer, 22 años, actividad moderada, objetivo energía y rendimiento.
- "Priorizar mi nutrición" genera un prompt con secciones (perfil, metas diarias de referencia: energía, proteína, fibra, hierro + vitamina C, calcio, vitamina D, folato, B12, magnesio, zinc, omega-3, variedad, hidratación), recetas del recetario y formato JSON.
- "Permitir recetas nuevas": la IA puede añadir recetas equilibradas (con aporte aproximado en notas); al importar se agregan al recetario y al plan.
- Valores orientativos; la app aclara que no sustituyen a un nutricionista.

## Versión 4 (app Android + rediseño según el mockup)
- Arquitectura: código web en `www/` (módulos `js/core, shop, timers, views, dialogs, actions`) envuelto con Capacitor 8 para Android; en PC se instala como PWA. Sin GitHub Actions: el APK se compila en local (`npm run apk`).
- Navegación: Hoy · Semana · [+] · Recetario · Compras (botón central de añadir rápido; atajo N en PC). «Más» desde el engranaje.
- Hoy: próximo platillo en bloque de color con cuenta regresiva, resumen nutricional del día y línea de tiempo con marca de «ahora».
- Semana: tabla de menú (comidas × días), mover platillos con pulsación larga o arrastrando en PC; Mes como vista secundaria.
- Recetas con `nutrition` por porción (kcal, protein, carbs, fat, fiber, iron, calcium); metas diarias desde el perfil; ejemplos con datos aproximados y migración automática.
- Cocinar: pantalla completa oscura, anillo del temporizador dentro del paso, ingredientes del paso, deslizar o flechas para avanzar.
- Compras: filtros por pasillo, cantidades alineadas, deslizar para marcar comprado.

## Versión 4.1 (nutrición del día con IA)
- La tarjeta «Lo planificado cubre» aparece siempre en el panel del día (Hoy, Semana y Mes): sin platillos muestra la meta diaria; con platillos sin datos ofrece «Estimar con IA».
- «Estimar nutrientes con IA» genera un prompt con los ingredientes y porciones de los platillos del día (solo los que no tienen datos, o todo el día), tu perfil y tu meta; la respuesta JSON actualiza la nutrición de esas recetas y guarda una sugerencia del día (`dayTips`).
- Detalle por platillo dentro de la tarjeta. En Más: estimar todo el recetario sin datos.

## Versión 4.2 (prompts con contexto y petición especial)
- «Importar con IA» del recetario genera el prompt en el momento: fecha de hoy y fechas reales en el ejemplo, perfil y meta diaria, lista de recetas que ya existen (no repetir, sí usarlas en el plan), nutrición obligatoria por receta y `dayTips`.
- «Completar con IA» pide `dayTips` por día (antes pedía un resumen que no se guardaba). Ambos importadores guardan las sugerencias en el día.
- Petición especial: cuadro opcional de reglas obligatorias (una por línea, guardadas en el perfil: `rules`, `rulesOn`). Se insertan arriba del prompt, numeradas y con prioridad sobre todo lo demás, y se pide verificarlas antes de responder. Aplica a los dos prompts.
