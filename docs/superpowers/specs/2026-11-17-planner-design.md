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
`{"schema":"planner/1","recipes":[...],"plan":[{"date","recipe","time","servings"}]}`; el importador acepta también una receta suelta o un arreglo, alias en español, y limpia bloques ```json.
