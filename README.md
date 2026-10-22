# 🎵 MusicWorld - App de Música Streaming (Android APK)

Aplicación móvil tipo Spotify construida con **React Native** y **Expo** (SDK 58), con streaming de música sin límites a través de la red descentralizada Audius.

---

## ✨ Características de MusicWorld

- **Diseño Oscuro Premium Spotify**:
  - Tema `#121212` con toques en verde vibrante `#1DB954`.
  - Icono y logotipo original de MusicWorld (un mundo rodeado por anillos de frecuencia de audio).
  - Pantalla principal con tendencias y canciones más populares en tiempo real.
- **Buscador de Canciones**:
  - Busca artistas, álbumes y pistas en streaming gratuito con carátulas de alta resolución.
  - Las búsquedas se lanzan con *debounce* y se cancelan entre sí, así que nunca se mezclan resultados fuera de orden.
- **Reproductor Flotante (MiniPlayer)**:
  - Barra flotante interactiva mientras navegas por la app, con barra de progreso en vivo.
- **Reproductor Pantalla Completa (Full Player)**:
  - Vista expandida con carátula grande, barra de progreso que se puede arrastrar para hacer *seek*, y botones de anterior, siguiente, pausa y reproducción en bucle/aleatorio.
  - Pestañas **Canción / Letras / Cola**: letras sincronizadas (LRCLIB) que se desplazan solas con la canción, o texto plano si no hay versión sincronizada.
  - Botón de **favoritos** (corazón) que se guarda en el teléfono con AsyncStorage.
- **Audio en Segundo Plano**:
  - La música continúa reproduciéndose mientras usas otras apps en el teléfono gracias a `expo-audio`, con servicio en primer plano y controles en la pantalla de bloqueo.
- **Respaldo sin conexión**:
  - Si Audius no responde, la app muestra una lista local de pistas de dominio público (Wikimedia Commons) en lugar de quedarse en blanco.

---

## 🧱 Arquitectura

- `App.js` — pantalla principal (tendencias, búsqueda, lista).
- `src/context/PlayerContext.js` — estado del reproductor con `expo-audio`: cola, avance automático, *seek* y controles de pantalla de bloqueo.
- `src/components/` — `MiniPlayer` y `FullPlayerModal`.
- `src/services/musicApi.js` — cliente de Audius: descubrimiento de host con *timeout* y caché, normalización de pistas y respaldo local.
- `src/services/lyricsApi.js` — letras desde LRCLIB (`/get` y, si no hay coincidencia exacta, `/search`), parser LRC y caché en memoria. Nunca lanza: sin red devuelve "sin letras".
- `src/services/storage.js` — favoritos en AsyncStorage con escrituras serializadas.

El estado de posición del reproductor va en un contexto separado del resto, para que la lista de canciones no se vuelva a renderizar en cada tick de progreso.

---

## 📱 Cómo Probar la App en tu Teléfono (En Vivo)

1. Instala la app gratuita **Expo Go** desde Google Play Store en tu celular.
2. En tu computadora, dentro de la carpeta `musica-app`, ejecuta:
   ```bash
   npx expo start
   ```
3. Escanea con la cámara o con la app Expo Go el **código QR** que aparecerá en tu terminal. ¡La app cargará al instante en tu celular!

> Nota: `expo-audio` incluye código nativo, así que para probar en un dispositivo con build propio usa `npx expo run:android` o un build de desarrollo de EAS. En Expo Go funciona el resto de la app.

---

## ✅ Comandos

```bash
npx expo start          # servidor de desarrollo
npx expo lint           # ESLint (eslint-config-expo)
npm test                # tests unitarios (Vitest)
npx expo-doctor         # diagnóstico de dependencias y configuración
```

### Pruebas

Los tests cubren la capa de red y la lógica de cola, que son las partes con más riesgo de regresión:

- `src/services/__tests__/musicApi.test.js` — sondeo de hosts en paralelo, caché del host válido, normalización de pistas, respaldo local, cancelación y errores de búsqueda.
- `src/services/__tests__/queue.test.js` — avance, retroceso, vuelta de la cola, modos de repetición (`off`, `all`, `one`) y orden aleatorio (shuffle).
- `src/services/__tests__/lyricsApi.test.js` — parser LRC, limpieza de títulos, respaldo a búsqueda, caché y fallos de red.
- `src/services/__tests__/storage.test.js` — añadir/quitar favoritos, toques simultáneos, datos corruptos y fallos de escritura.

```bash
npm test
```

---

## 📦 Cómo Generar el Archivo APK Instalable

Para compilar el archivo `.apk` de instalación directa para cualquier teléfono Android:

1. Ejecuta el comando de compilación con EAS:
   ```bash
   npx eas-cli build --platform android --profile preview
   ```
   *(EAS compilará en la nube y te proporcionará el enlace de descarga directa del `.apk` listo para instalar).*

El perfil `production` genera un **AAB** para publicar en Google Play; `preview` genera el **APK** para instalar directamente.

El APK de la versión actual está en `dist/MusicWorld-v1.0.0.apk` (compilado en la nube con EAS el 21-10-2026). El build anterior, basado en `expo-av`, se conserva como `dist/MusicWorld-v1.0.0-expo-av.apk` solo como referencia.

> En Windows, `npx expo run:android` no compila de forma nativa: ninja falla con rutas de más de 260 caracteres al generar el código de `react-native-safe-area-context`. Usa EAS (nube) para compilar el APK.
