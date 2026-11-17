# Planner de Recetas

Mini app (PWA) para planificar las comidas del mes: recetas, plan por día con hora, lista de compras y modo cocinar con temporizadores. Sin servidor ni cuentas: los datos viven en el dispositivo.

## Usar
- **PC:** abre `index.html` desde un servidor estático (`python3 -m http.server`) y visita `http://localhost:8000`, o publícalo en cualquier hosting estático (GitHub Pages, Netlify, Render static…).
- **Android:** abre la URL publicada en Chrome → menú ⋮ → *Instalar app* / *Añadir a pantalla de inicio*. Funciona sin conexión.

## IA
En **Datos → Importar JSON de IA** copia el prompt, pídele a tu IA las recetas (y opcionalmente el plan del mes) y pega la respuesta. Formato en `docs/superpowers/specs/2026-11-17-planner-design.md`.

## Pasar datos entre dispositivos
**Datos → Exportar respaldo** y **Importar respaldo** en el otro dispositivo. (La sincronización en la nube es la siguiente fase; la persistencia está aislada en `Store` dentro de `app.js`.)
