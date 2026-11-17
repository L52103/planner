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
