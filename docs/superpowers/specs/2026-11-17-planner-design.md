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

## Versión 5 (base de datos en la nube)
- Supabase, proyecto `planner` (sa-east-1). Tablas `recipes` (columnas reales + JSON para ingredientes, pasos y nutrición), `plan_days`, `shopping_lists`, `user_settings`; `updated_at` lo pone el servidor y los borrados son lógicos. RLS por `auth.uid()`.
- Cuenta personal con correo y contraseña. Offline-first: `js/cloud.js` compara huellas por entidad (receta, día, lista, ajustes) con la última sincronización; aplica lo remoto si no hubo cambio local, sube lo local cambiado y, si cambió en ambos lados, gana lo local. En la primera sincronización de un dispositivo se descartan recetas idénticas por nombre y contenido (evita duplicar los ejemplos).
- Se sincroniza tras cada guardado (2,5 s), al abrir la app, al volver la conexión y cada 2 minutos. El service worker ya no cachea peticiones a otros dominios.

## Versión 2.4 (sistema de actualizaciones)
- Versión única en `package.json`, Android (`versionCode`/`versionName`) y `www/js/version.js` (`APP_VERSION`), actualizada por `scripts/release.mjs`.
- Publicación: función Edge `publish-release` (token en cabecera `x-publish-token`, validado contra `release_config`), que sube el APK al bucket público `releases`, registra la versión en la tabla `releases` y reescribe `latest.json`.
- App (`js/updates.js`): consulta `latest.json` al abrir y cada 6 h; aviso en Hoy y Más con novedades, «Más tarde» recuerda la versión descartada; punto rojo en el engranaje. Android abre la descarga del APK con @capacitor/browser; PC/web indica `git pull`.
- Firma: todas las versiones usan la misma clave (la de las 2.0–2.3), guardada en `release_config`; Gradle la toma de `android/keystore/planner.keystore` si existe.

## Versión 2.5 (auditoría UX, voz, despensa, presupuesto y listas compartidas)
Código nuevo en `www/js/extras.js` (acciones `XA` y cambios `XC` que se suman a `A` y `C`); `save()` llama a `afterSave()`, que reprograma recordatorios y sincroniza listas compartidas (800 ms).

### Interfaz y auditoría UX
- Diálogos propios que nombran la entidad con botón de verbo (`confirmDlg`); acciones reversibles con aviso «Deshacer» (`withUndo`).
- Borrador del editor (`Drafts`, `localStorage` `planner.draft`): autoguardado a los 400 ms, se restaura con aviso y «Descartar cambios».
- Renombrar listas en el sitio, validación en línea, tooltips, objetivos de 44 px y texto mínimo de 12 px.
- Insignia de sincronización en la barra superior (`syncBadge`, estados `ok`/`syncing`/`error`/`off`); tocarla sincroniza o lleva a conectar la cuenta.
- Bienvenida en 3 pasos (perfil, metas, cómo empezar); marca `planner.onboarded` en `localStorage`.

### Modelo de datos
Estado `version: 4`, con `normalizeExtra()` en `core.js`:
- `S.pantry`: `[{id, name, qty, unit, at}]`. `qty` 0 significa «siempre hay». Clave de comparación `pantryKey(name, unit)` (nombre sin tildes + unidad normalizada).
- `S.prices`: `{ "nombre|unidad": precioUnitario }`, recordado al guardar lo comprado (`rememberPrice`).
- `S.history`: `[{id, recipeId, date, rating 0–5, src (id del platillo), at, used?: [{name, unit, qty}]}]`. `used` registra lo descontado de la despensa para poder devolverlo al desmarcar.
- `S.leftovers`: `[{id, recipeId, portions, date, until, src}]`; `until` = fecha cocinada + 3 días.
- `S.prefs`: objeto libre. `rem` `{cook, defrost, defrostAt}` (recordatorios), `budget` (por semana), `currency`, `spent` `{ "lunes YYYY-MM-DD": monto }` (gasto de artículos ya retirados de las listas, se conservan 26 semanas).
- Platillo del plan: `lo: true` cuando son sobras (no se compran ni generan recordatorios ni nuevas sobras).
- Artículo de lista: `price` (precio de la línea), `est` (precio estimado desde `S.prices`), `at` (momento en que se marcó comprado, para el gasto semanal), `have` (texto «X en la despensa»).
- Lista: `share: {id, code}` cuando está compartida.

### Despensa, sobras y presupuesto
- `needFromPlan(from, to)` = `aggregate()` menos la despensa: no pide lo que está en la despensa con `qty` 0; resta la cantidad si coincide nombre y unidad; si queda cubierto lo omite y si no marca `have`.
- Al marcar un platillo como hecho (`onDishDone` → `logCooked`): `useFromPantry` descuenta (escalado por porciones; no si es `lo`), se añade a `history` y, si las porciones superan `profile.servings`, se crean sobras. Al desmarcar se devuelve lo usado y se borran el historial y las sobras de ese platillo.
- `weekSpend()` = `prefs.spent[semana]` + artículos marcados esa semana con `price`.
- `recipeScore(r)` = favorita (+1,5) + (promedio − 3) × 0,75; entra en la puntuación de «Completar con el recetario» junto con los días desde la última vez.
- Resumen semanal: `weekNutrition()` promedia los días con datos y compara contra la semana anterior (tendencia ±3 %); consejos para nutrientes por debajo del 85 % de la meta.

### Sincronización del campo `extra`
- Columna `user_settings.extra jsonb`; la entidad de ajustes (`s`) pasa a ser `{profile, dayTips, extra: {pantry, prices, history, leftovers, prefs}}` y se sube con el mismo `upsert`. `extraOf()` normaliza lo remoto para que la huella coincida con la local.
- Si los ajustes cambiaron en ambos lados, o es la primera sincronización del dispositivo, se aplica `mergeSettings(local, remoto, fresh)` en lugar de «gana lo local»:
  - `history`: unión por `id`, gana lo local, ordenado por `at`. `prices` y `dayTips`: unión, gana lo local.
  - `pantry`: en la primera sincronización, unión por `pantryKey` (gana lo local); después se conserva lo local, para que los descuentos y borrados no «resuciten».
  - `leftovers`: unión por `id` solo en la primera sincronización; después, lo local.
  - `prefs`: en la primera sincronización gana lo remoto sobre lo local; después gana lo local.
  - `profile`: en la primera sincronización gana el remoto; después el local.

### Listas compartidas (`shared_lists`)
Tablas `shared_lists {id, code único, owner, name, data jsonb {name, items, dels}, version, updated_at}` y `shared_list_members {list_id, user_id}`. RLS: miembros leen y actualizan (vía `is_list_member`, `security definer`); el dueño inserta y elimina; cada miembro puede borrar su membresía. Un trigger añade al dueño como miembro; la RPC `join_shared_list(p_code)` añade a quien llama y devuelve la lista. El código son 6 caracteres de un alfabeto sin ambiguos (sin I, L, O, 0, 1), con reintento si choca. Migración: `supabase/migrations/20261120000000_extras_and_shared_lists.sql`.

Algoritmo (`Shared` en `extras.js`; metadatos locales por lista en `localStorage` `planner.shares`: `{v, snap, name}`):
1. **Snapshot**: `snap` guarda, por artículo, su forma canónica (sin el sello `u`) tal como estaba en la última sincronización con la nube.
2. **Delta local**: artículos cuya forma difiere del snapshot (`changed`, con `u = ahora`), artículos del snapshot que ya no existen (`dels`) y el nombre si cambió.
3. **Empujar** (`push`, 600 ms tras guardar): lee la fila remota, la combina con `mergeShared(remoto, delta)` y actualiza con `update … eq('version', row.version)` y `version + 1`. Si otro cambió antes (0 filas), reintenta hasta 5 veces. Tras tener éxito reaplica el resultado y renueva el snapshot.
4. **Combinar** (`mergeShared`): cada artículo lleva `u` (última modificación); gana el de `u` mayor. Los borrados quedan como lápidas en `data.dels[id] = momento`; un artículo con `u` ≤ lápida se descarta, y las lápidas de más de 30 días se limpian.
5. **Recibir**: Realtime `postgres_changes` (UPDATE y DELETE sobre la fila, filtro `id=eq.<id>`); además `pull` al abrir y al volver la app a primer plano. `onRemote` ignora versiones ya vistas, combina con el delta local pendiente, actualiza el snapshot con lo remoto (lo no subido sigue pendiente) y, si había cambios locales, los empuja. Si la fila desaparece, la lista deja de estar compartida.
6. **Dejar de compartir**: el dueño borra la fila; los demás borran su membresía. La lista queda en el dispositivo sin `share`. El campo `share` de la lista también viaja en la sincronización personal (`shopping_lists.data`).

### Recordatorios
`upcomingReminders(3)` calcula, para cada platillo pendiente (no `lo`) de los próximos días:
- `cook`: a la hora de la comida menos (tiempo total de la receta o 5 min) menos 10 min.
- `defrost`: la noche anterior a la hora `defrostAt` (21:00 por defecto) si algún ingrediente es del pasillo «Carnes y pescados».
En Android `Reminders.sync()` cancela las notificaciones propias (`extra.kind = 'rem'`; las de temporizador no se tocan) y programa hasta 40 futuras en el canal `reminders` con `allowWhileIdle`; se repite tras cada guardado. En PC/web `Reminders.tick()` dispara una `Notification` (si hay permiso) y un aviso en la app, una sola vez por clave (`planner.remFired`, se limpia a los 3 días, ventana de 15 min). «Hoy» muestra los recordatorios activos.

### Modo cocina
Tamaño de letra `--ck-fs` entre 0,8 y 1,6 (pasos de 0,15, `planner.cookFont`). Toque en el 30 % izquierdo retrocede, el resto avanza. Lectura con `@capacitor-community/text-to-speech` o `speechSynthesis`; órdenes con `@capacitor-community/speech-recognition` (reinicia la escucha al terminar) o la API web. Órdenes: siguiente, atrás, repite, temporizador; se ignoran mientras se lee en voz alta. Android: permiso `RECORD_AUDIO` y `<queries>` para `RecognitionService` y `TTS_SERVICE`.

### Importar desde enlace o foto
- Enlace: la app llama a la función Edge `import-recipe` (`POST {url}`). Extrae schema.org `Recipe` de los bloques JSON-LD (incluye `@graph`, `mainEntity` y listas) y devuelve `{recipe}` normalizada (tiempos ISO 8601 a minutos, pasos de `HowToStep`/`HowToSection`, nutrición). La app convierte cada línea de ingrediente a `{name, qty, unit}` (fracciones y alias de unidades), detecta temporizadores en los pasos, adivina la categoría y abre el resultado como borrador en el editor. Sin JSON-LD responde `{error: "no_recipe", title, text, url}` y la app ofrece copiar un prompt con el texto (hasta 7000 caracteres) para la IA.
- Foto: prompt de IA con las instrucciones de transcripción; la persona adjunta la foto en su IA y pega la respuesta JSON.
- Protecciones SSRF de la función: solo `http(s)`; se bloquean `localhost`, `.local`, `.internal`, IPv6 literales y rangos privados o reservados IPv4 (0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.168/16, multicast y superiores); el nombre se resuelve por DNS (registros A) y se rechaza si alguna IP es privada; las redirecciones se siguen a mano (máx. 5) y cada salto repite todas las comprobaciones; tope de 3 MB de descarga y 12 s de tiempo límite por petición.
