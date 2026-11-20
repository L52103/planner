# Planner de Recetas

App para planificar las comidas del mes: recetario, calendario por comidas, listas de compras, modo cocinar con temporizadores y prompts para IA (incluido un prompt nutricional).

Un solo código web (`www/`) que se usa de tres formas:

| Plataforma | Cómo | Notas |
|---|---|---|
| **Android** | App nativa con [Capacitor](https://capacitorjs.com) (`android/`) | Alarmas del temporizador y recordatorios aunque la app esté cerrada, pantalla encendida al cocinar, voz (leer en voz alta y órdenes; pide permiso de micrófono), compartir y guardar respaldos, botón atrás. |
| **PC (Windows/Mac/Linux)** | PWA instalable desde Edge o Chrome | Ventana propia, icono en el menú Inicio, funciona sin internet. |
| **Navegador** | `www/` en cualquier hosting estático | Igual que la PWA. |

## Novedades 2.5
- **Más claridad y seguridad al usar la app**: los diálogos nombran lo que vas a borrar y su botón lleva el verbo («Eliminar receta»); las acciones rápidas se pueden revertir con **Deshacer**. El editor guarda un borrador y lo recupera si lo cierras sin querer; las listas se renombran en el sitio; los formularios avisan de los errores junto al campo. Botones de 44 px y texto de 12 px como mínimo.
- **Sincronización visible**: un icono de nube en la barra superior muestra el estado y, al tocarlo, sincroniza (o te lleva a conectar tu cuenta).
- **Bienvenida en 3 pasos**: perfil, metas y cómo empezar (ejemplos, IA, enlace o foto, tu cuenta, o vacío).
- **Modo cocina**: letra ajustable, toque para avanzar, lectura en voz alta y órdenes por voz.
- **Despensa**: lo que ya tienes se resta de las listas del plan y se descuenta al cocinar.
- **Sobras inteligentes**: si cocinas más porciones de las que comes, te recuerda comerlas.
- **Recordatorios**: empezar a cocinar y descongelar la noche anterior.
- **Importar recetas desde un enlace o una foto**.
- **Resumen nutricional semanal** con tendencia frente a la semana anterior.
- **Presupuesto**: precios recordados y gasto semanal frente a tu presupuesto.
- **Historial y valoraciones**: «Completar» prioriza tus favoritas y las mejor valoradas.
- **Listas compartidas en tiempo real** con un código de 6 caracteres (las dos personas necesitan cuenta).

## Cómo usar las novedades
**Sincronización.** El icono de nube de la barra superior cambia de color según el estado (sincronizado, sincronizando, error o sin conectar).

**Bienvenida.** Aparece la primera vez. Puedes repetirla en *Más → Bienvenida*.

**Modo cocina.** Dentro de una receta, pulsa *Cocinar*:
- *A−* / *A+* cambian el tamaño de la letra (se recuerda).
- Toca el lado derecho de la pantalla para avanzar y el izquierdo (30 %) para volver.
- *Leer en voz alta* lee cada paso al llegar a él.
- *Manos libres* escucha las órdenes «siguiente», «atrás», «repite» y «temporizador» (pide permiso de micrófono). Las dos opciones aparecen solo si tu dispositivo las admite.

**Despensa.** En *Compras → Despensa* añade producto, cantidad y unidad; sin cantidad significa «siempre hay» y no se pide nunca. Las listas creadas desde el plan piden solo lo que falta y marcan lo que ya tienes. Al marcar un platillo como hecho se descuenta lo que usa la receta (y se devuelve si lo desmarcas). En una lista, *Guardar lo comprado en la despensa* pasa lo marcado a la despensa.

**Sobras.** Si planificas más porciones que personas indicaste en tu perfil, al marcar el platillo como hecho te sobran porciones: aparecen en **Hoy** («Sobras en la nevera», con vigencia de 3 días) y puedes planificarlas para hoy o mañana. No cuentan para las compras.

**Recordatorios.** En *Más → Recordatorios* activa «Empezar a cocinar» (avisa según lo que tarda la receta y la hora de la comida) y «Descongelar la noche anterior» (si lleva carne o pescado; eliges la hora). En Android llegan como notificaciones aunque la app esté cerrada; en PC, mientras la app esté abierta, y también se muestran en **Hoy**.

**Importar recetas.** En el Recetario, el botón de importar ofrece:
- *Desde un enlace*: pega la dirección; la receta se abre en el editor para revisarla. Si la página no trae datos estructurados, copias un prompt con el texto de la página para tu IA y pegas su respuesta.
- *Desde una foto*: copias un prompt, lo pegas en tu IA con la foto adjunta y pegas su respuesta.
- *Pegar respuesta de la IA*: igual que antes.

**Resumen semanal.** El botón *Resumen* de Semana y Mes muestra energía por día frente a tu meta, el promedio de energía, proteína, fibra, hierro y calcio con su tendencia y consejos para lo que quede bajo.

**Presupuesto.** Añade el precio al editar un artículo; al guardar lo comprado se recuerda el precio por unidad y se estima en las listas siguientes. En *Compras*, fija tu presupuesto semanal y moneda para ver lo gastado de lunes a domingo y lo que te queda.

**Historial y valoraciones.** Al marcar un platillo como hecho puedes tocar *Valorar* (1 a 5 estrellas). Cada receta muestra su historial. Al *Completar con el recetario*, las favoritas y las mejor valoradas salen antes.

**Listas compartidas.** Abre una lista de compras y pulsa *Compartir → Compartir en vivo*; envía el código a la otra persona, que entra a *Compras → Unirme a una lista*. Ambas necesitan cuenta; los cambios aparecen al momento. *Dejar de compartir* conserva la lista en tu dispositivo.

## Estructura
- `www/` código de la app: `index.html`, `style.css` y módulos en `www/js/` (núcleo, compras, temporizadores, vistas, diálogos, acciones, nube y extras de la 2.5). Sin dependencias ni bundler; fuentes locales.
- `android/` proyecto Android generado por Capacitor (iconos, permisos, splash).
- `supabase/` funciones Edge (`publish-release`, `import-recipe`) y migraciones SQL (`supabase/migrations/`).
- `capacitor.config.json` configuración de la app nativa.
- `scripts/copy-fonts.mjs` copia las tipografías a `www/fonts`.
- `docs/` diseño y mockups.

## Probar en el navegador
```bash
npm install
npm run serve   # http://localhost:8123
```

## Compilar el APK en tu PC (sin GitHub Actions)
Requisitos: Node 20+, JDK 21 y el SDK de Android (lo trae Android Studio; por línea de comandos: `platforms;android-36`, `build-tools;36.0.0` y `platform-tools`). Crea `android/local.properties` con `sdk.dir=/ruta/al/sdk` si no usas Android Studio.

```bash
npm install
npm run apk
```
El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`. Pásalo al teléfono e instálalo (Android pedirá permitir «instalar apps de origen desconocido»).

Con Android Studio: `npm run sync`, luego abre la carpeta `android/` y pulsa *Run* con el teléfono conectado por USB.

## Instalar en PC
1. Publica `www/` (o ejecútalo con `npm run serve`).
2. Ábrelo en Edge o Chrome y pulsa el icono **Instalar** de la barra de direcciones.

## Datos
Todo se guarda en el dispositivo (los borradores del editor también). Para pasar datos entre el teléfono y el PC: *Más → Exportar respaldo* y *Importar respaldo*. Con cuenta, además se sincroniza en la nube (ver abajo).

## Base de datos en la nube (Supabase)
La app usa el proyecto **planner** de Supabase (PostgreSQL). En la app: **Más → Tu base de datos en la nube**, crea tu cuenta (confirma el correo que llega) y entra. Desde ese momento recetas, plan, listas, perfil, despensa, historial y preferencias se sincronizan solos entre el teléfono y el PC; sin internet todo sigue funcionando y se sincroniza al volver.

Tablas (cada usuario solo ve sus filas, protegido con RLS; en las listas compartidas, solo sus miembros):

| Tabla | Contenido |
|---|---|
| `recipes` | Una fila por receta: nombre, categoría, dificultad, porciones, tiempos, `ingredients` y `steps` (JSON), `nutrition` por porción (JSON), favorita. |
| `plan_days` | Un día por fila con sus platillos (`items`). |
| `shopping_lists` | Listas de compras con sus artículos. |
| `user_settings` | Perfil nutricional, reglas obligatorias y sugerencias por día; columna `extra` (JSON) con despensa, precios recordados, historial, sobras y preferencias (recordatorios, presupuesto, moneda). |
| `shared_lists` | Listas de compras compartidas: código de 6 caracteres, contenido (`data`), `version` y dueño. Las ven y editan sus miembros; solo el dueño la elimina. |
| `shared_list_members` | Quién participa en cada lista compartida. Cada persona puede salirse de una lista. |

**Cargar recetas directamente en la base**: en el panel de Supabase, *Table Editor → recipes → Insert row*. Rellena al menos `name` y `user_id` (tu id de usuario, en *Authentication → Users*); `ingredients` con el formato `[{"name": "Lentejas", "qty": 300, "unit": "g"}]` y `steps` con `[{"text": "Cocina", "timer": 25}]`. La app las trae en la siguiente sincronización. Los borrados son lógicos (`deleted = true`).

El esquema está versionado en `supabase/migrations/` (la 2.5 añade `user_settings.extra`, `shared_lists` y `shared_list_members`, con RLS y Realtime). La función Edge `import-recipe` (importar desde enlace) se despliega con `supabase functions deploy import-recipe`.

## Actualizaciones
La app avisa sola cuando hay una versión nueva (al abrirla y cada 6 horas). En **Hoy** aparece el aviso con las novedades y en **Más → Actualizaciones** puedes buscar a mano.
- **Android**: «Actualizar» descarga el APK nuevo; ábrelo y se instala encima, sin perder datos (todas las versiones van firmadas con la misma clave).
- **PC**: indica ejecutar `git pull` en la carpeta del planner y recargar.

### Publicar una versión
```bash
PUBLISH_TOKEN=… node scripts/release.mjs 2.5.0 "Novedad 1" "Novedad 2"
```
Sube el número de versión (package.json, Android y `www/js/version.js`), compila el APK, comprueba la firma y lo publica en Supabase (bucket `releases`, `latest.json` y tabla `releases`) mediante la función `publish-release`. Sin `PUBLISH_TOKEN` solo compila.

La clave de firma (`android/keystore/planner.keystore`) y el token **no están en git**: se guardan en la tabla privada `release_config` de Supabase (solo accesible desde el servidor). Si la clave se pierde, Android no dejará instalar encima y habría que desinstalar la app.
