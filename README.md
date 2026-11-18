# Planner de Recetas

App para planificar las comidas del mes: recetario, calendario por comidas, listas de compras, modo cocinar con temporizadores y prompts para IA (incluido un prompt nutricional).

Un solo código web (`www/`) que se usa de tres formas:

| Plataforma | Cómo | Notas |
|---|---|---|
| **Android** | App nativa con [Capacitor](https://capacitorjs.com) (`android/`) | Alarmas del temporizador aunque la app esté cerrada, pantalla encendida al cocinar, compartir y guardar respaldos, botón atrás. |
| **PC (Windows/Mac/Linux)** | PWA instalable desde Edge o Chrome | Ventana propia, icono en el menú Inicio, funciona sin internet. |
| **Navegador** | `www/` en cualquier hosting estático | Igual que la PWA. |

## Estructura
- `www/` código de la app: `index.html`, `style.css` y módulos en `www/js/` (núcleo, compras, temporizadores, vistas, diálogos, acciones). Sin dependencias ni bundler; fuentes locales.
- `android/` proyecto Android generado por Capacitor (iconos, permisos, splash).
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
Todo se guarda en el dispositivo. Para pasar datos entre el teléfono y el PC: *Más → Exportar respaldo* y *Importar respaldo*. La sincronización en la nube es la siguiente fase (la persistencia está aislada en `Store` dentro de `www/app.js`).
