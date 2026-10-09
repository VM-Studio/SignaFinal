# Cusat View · API descubierta

Captura del 9/10/2026 con `scripts/cusat-descubrir.ts` (login real, mapa, 90 s de tráfico) y lectura
del JavaScript público de la web (`js/cvs_06052026.js`, ofuscado). Sin credenciales: el usuario,
la contraseña, el email de la cuenta y el id de usuario no figuran acá.

## Cómo habla la web con el servidor

- **Un solo endpoint:** `POST https://cusatglobal.com/webApi`.
- **Cuerpo:** JSON enviado como `Content-Type: text/plain;charset=UTF-8`. Cada llamada es un objeto
  con sus parámetros más `iq`, el número de operación. Ejemplo: `{"uid": <user_id>, "iq": 338100}`.
- **Respuesta:** JSON plano (no comprimido en las llamadas capturadas).
- **Sin cookies, sin token, sin WebSocket.** La web refresca el mapa pidiendo la lista cada **25 s**
  (polling).

## Operaciones

| iq | Para qué | Parámetros | Respuesta |
|---|---|---|---|
| `3387061` | **Login** | `us` usuario, `ps` contraseña, `tk` "" | `[{ user_id, n (usuario), fn (razón social), m (email), pw }]` |
| `338100` | **Vehículos con posición actual** (lo que pinta el mapa) | `uid` = user_id | `{ u: [unidades], p: [], z: [], a: null }` |
| `90100` | Dirección en texto de una unidad | `iu` = user_id, `un` = unit_id | `[{ iu, un, lt: "-34,49901", lg: "-58,54413", geo: "GRANADA, MAESTRO 1, MARTINEZ, SAN ISIDRO…", d: "306" }]` |
| `3381030` | **Historial (recorrido) de un día** | `iduser` = user_id, `idunit` = unit_id, `report_date` "AAAA-MM-DD" | lista de puntos `{ lt, ln, e (hora), s (velocidad) }` |
| `338900` | Geocercas (leer) | `iu`, `idg` | (no capturado) |
| `338500` / `338800` | Geocercas (crear / editar) | `iu`, polígono… | (no se usa) |
| `3381020` | Activar/desactivar "estacionamiento" | `unit_id`, `lat`, `lon`… | (no se usa: modifica la cuenta) |
| `3385473`, `3381100` | Configuración de la cuenta | | (no se usa) |
| `3386451` | Mandar un mensaje a la unidad | | (no se usa) |

**La sesión es solo el `user_id`.** El login devuelve el `user_id` y las llamadas siguientes mandan
ese número, nada más. El adaptador hace login para obtenerlo y lo guarda en memoria.

## Lista de vehículos (`iq 338100`) · campos de cada unidad

| Campo Cusat | Qué es | En el adaptador |
|---|---|---|
| `unit_id` | id de la unidad (número) | `idExterno` |
| `plate` | patente, sin espacios | `patente` |
| `ali` | nombre que se ve en la app ("Mercedes 710", "Kangoo ll") | `nombre` |
| `lat`, `lon` | coordenadas, **números** con signo (ya vienen bien) | `latitud`, `longitud` |
| `speed` | velocidad, **texto** ("0") en `speedt` ("Km/h") | `velocidadKmh` (número) |
| `direction` | rumbo en grados | `rumbo` |
| `load_date` | fecha y hora del último reporte, `"dd/MM/aaaa HH:mm:ss"` en **hora argentina** | `fechaGps` |
| `ev` | último evento en texto: `"POS. EN CTO./MOV."` (con contacto, en movimiento), `"POS. SIN CTO./MOV."` (sin contacto) | `motorEncendido` = contiene "EN CTO" |
| `ignition_on` | viene vacío siempre: **no sirve** | — |
| `sat` | satélites | (diagnóstico) |
| `o` | contador interno (¿odómetro en metros?), no coincide con los km del tablero | no se usa |
| `event_date`, `usa_date`, `tz`, `bat`, `in_`, … | otros datos del equipo | no se usan |

La dirección en texto no viene en la lista: sale de `iq 90100` (una llamada por unidad, con las
coordenadas como texto con coma decimal).

## Los seis vehículos de la flota: están todos

| Nombre en Cusat (`ali`) | Patente | Dónde estaba (9/10, 00:40) | Último reporte |
|---|---|---|---|
| Mercedes 710 | HFD336 | Granada y Maestro, Martínez | 00:38 |
| Kia | AH282PU | Triunfo Argentino, Martínez | 00:38 |
| Zanella | AG149BJ | Triunfo Argentino, Martínez | 00:40 |
| Oroch | AC689NR | Villa Ballester, San Martín | 00:39 |
| Kangoo | AF399OO | Lincoln (Ruta 188) | 00:38 |
| Kangoo ll | AF399OP | Florencio Varela | 00:38 |

Coordenadas y fechas correctas en los seis. Los nombres en Cusat están en minúscula ("Kangoo ll"):
el emparejamiento compara por patente y, si no, por nombre sin importar mayúsculas.

**La cuenta tiene 15 unidades, no 6.** Las otras 9 son: una Hilux (en Lincoln, junto a la Kangoo),
una retroexcavadora ("Retro - Cukurova", en Don Torcuato) y siete vehículos particulares (motos y
autos). Quedan en "Vehículos de Cusat sin enlazar" en Configuración → Rastreo; no se cargan solos.
Para confirmar con el dueño: si la Hilux y la retro se suman a la flota.

## Lo que no se pudo capturar

- **El historial no se ejecutó en la captura** (el script no pudo hacer clic en el vehículo de la
  versión `mobile.html`); la llamada salió del JavaScript de la web. **Confirmado el 9/10/2026 con
  `scripts/cusat-probar.ts`:** `idunit` es el `unit_id` (con la patente devuelve vacío) y `e` se
  interpreta bien como hora argentina del día consultado. Con el vehículo estacionado, Cusat guarda
  un punto por hora; en movimiento, más seguido.
- **Geocercas y alertas:** no hay llamadas de alertas en la web; las geocercas existen
  (`338900`) pero la cuenta no tiene ninguna (`z: []`).
- **Ignición:** `ignition_on` viene vacío; se usa el texto del evento (`ev`).

## Seguridad (para hablar con Cusat)

Las llamadas después del login no llevan cookie ni token: alcanza con el número de usuario. Es un
problema de la web de Cusat, no de esta app; conviene pedirles una API oficial con token (texto en
`docs/cusat/README.md`).
