# BusTrack

Trazabilidad y aforo de buses institucionales: GPS/ETA en vivo, abordaje por QR, aforo calculado (no contado), alarma "no te duermas", incidencias y reseñas.
Demo del hackathon: **pasajero** + **conductor**. Datos simulados en memoria.

## Correr en VS Code

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 15 tests de servicios (ETA, aforo, QR, alarmas, reseñas)
npm run typecheck
npm run build
```

Extensiones recomendadas: se sugieren solas al abrir la carpeta (`.vscode/extensions.json`).
Fuentes e íconos van empaquetados: funciona sin internet.

## Credenciales demo

| Rol | Usuario | Clave |
|---|---|---|
| Pasajero (Diego) | `diego@espol.edu.ec` | `demo1234` |
| Conductor (Carlos, Ruta 4 hoy) | `carlos.mendoza@bustrack.edu` | `conductor123` |
| Conductora (Ana) | `ana.torres@bustrack.edu` | `conductor123` |
| Conductor (Luis) | `luis.paredes@bustrack.edu` | `conductor123` |
| Conductor (Jorge, de reserva) | `jorge.salazar@bustrack.edu` | `conductor123` |
| Coordinación | `coordinacion@bustrack.edu` | `coord123` |
| Admin (solo API, sin UI) | `admin@bustrack.edu` | `admin` |

La pantalla de inicio (`/`) entra directo con cualquiera de los dos roles. La programación (qué conductor y qué bus cubren cada ruta cada día) la edita Coordinación en `/coordinador/planificador`, por día o para toda la semana; al entrar, el conductor recibe la ruta y el bus que le tocan hoy.

## Arquitectura (clean architecture)

```
src/
├── domain/                 # Reglas y contratos. No importa nada de fuera.
│   ├── model/              #   User, Route, Bus, Trip, Boarding, Incident, Review, AlarmPreference
│   └── repository/         #   Interfaces (IUserRepository, ITripRepository, ...) — todas async
├── data/                   # Implementaciones de los contratos
│   ├── datasource/         #   InMemoryDatabase + seed.ts + supabaseClient.ts (stub)
│   └── repository/         #   InMemoryRepositories.ts
├── service/                # Casos de uso. Dependen solo de domain.
│   ├── EtaService          #   ETA = 0.5·velocidad actual (EMA) + 0.5·histórica por tramo + 30 s por parada
│   ├── BoardingService     #   QR pase / QR unidad / manual. Aforo = abordajes abiertos
│   ├── TripSimulationService # GPS simulado (x10 por defecto)
│   ├── PassengerService, DriverService, AlarmService, AlarmEvaluator,
│   └── IncidentService, ReviewService, AuthService
├── api/                    # "Controllers": única puerta de entrada para la UI
│   ├── PassengerController, DriverController, AdminController, AuthController
│   ├── ApiResult.ts        #   {ok:true,data} | {ok:false,error,code}
│   ├── container.ts        #   composition root (único lugar donde se eligen implementaciones)
│   └── index.ts            #   `app` singleton (+ arranca la simulación)
└── ui/                     # React. Solo habla con `app.*` (api/), nunca con data/ ni service/
    ├── pages/{passenger,driver}, components/, lib/, session/
```

Regla de dependencias: `ui → api → service → domain ← data`. La UI nunca importa repositorios.

## Pantallas (de Stitch)

| Ruta | Pantalla |
|---|---|
| `/pasajero` | Inicio: mapa, ruta activa, ETA |
| `/pasajero/pase` | Pase de abordaje (QR dinámico 60 s) |
| `/pasajero/alertas` | Alarmas "no te duermas" |
| `/pasajero/alertas/reportar` | Reportar incidencia |
| `/pasajero/perfil` | Perfil |
| `/conductor` | Login + configuración de ruta |
| `/conductor/panel` | Panel de viaje: aforo ±, finalizar (mantener 2 s) |
| `/conductor/incidencia` | Incidencia del conductor |

Panel de demo (botón flotante oscuro): velocidad de simulación, acercar el bus a una parada, llenar el bus, reiniciar. Quítalo borrando `<DevPanel />` en `PassengerLayout` y `DriverPanelPage`.

## Probar el flujo completo

1. `/` → "Entrar como pasajero". Panel de demo → **Acercar el bus a mi parada de subida** → aparece el aviso de que el bus se acerca.
2. `/pasajero/pase` → **Simular escaneo (+1/−1)**: el conductor "escanea" tu pase y el aforo sube; el estado pasa a "A bordo".
3. Panel de demo → **Acercar el bus a mi bajada (probar alarma)**: salta la alarma de despertar; al llegar se cierra el abordaje y aparece la reseña.
4. Pasajero: `/pasajero/rutas` → **Registrar ruta** en otra ruta → el mapa en vivo pasa a mostrar esa ruta y su bus. Cada ruta muestra el conductor de hoy y su calificación.
5. Conductor: `/conductor` → correo + contraseña → panel con ± de aforo manual y finalizar (mantener 2 s). En **Perfil** (menú inferior) ve las reseñas de su bus.
6. Coordinación: `/coordinador` → planificador → cambia conductor/bus de una ruta y guarda. El conductor recibe esa ruta al entrar y el pasajero lo ve en **Rutas**. No deja repetir conductor ni bus el mismo día, ni usar buses fuera de línea.
7. Pasajero y conductor **no se ven entre sí en pestañas distintas** (estado en memoria por pestaña; ver límites). Para probar la interacción usa el botón "Simular escaneo".

## Migrar a Supabase

1. Crear tablas con los mismos campos que `domain/model/*` (una por entidad).
2. Implementar `SupabaseXRepository` en `data/repository/` cumpliendo las interfaces de `domain/repository/`.
3. Rellenar `data/datasource/supabaseClient.ts` (`createClient(URL, ANON_KEY)`).
4. Cambiar las implementaciones en `api/container.ts`. Nada más cambia.
5. Para tiempo real, sustituir el polling de 500 ms (`ui/lib/usePolling.ts`) por `supabase.channel(...)`.

## Límites reales (leer antes de la demo)

- **Datos solo en memoria**: se pierden al recargar y **no se comparten entre pestañas/dispositivos**. Dos teléfonos no verán el mismo bus hasta conectar un backend.
- **GPS simulado**: no usa `navigator.geolocation` ni el GPS del conductor.
- **Mapa esquemático (SVG)**, no Leaflet/OSM.
- **Auth de demo**: credenciales en el seed, sin hash ni sesión real.
- **La alarma solo suena con la pestaña abierta**. En producción necesita push desde servidor; un navegador móvil en segundo plano la suspende.
- **Panel admin**: existe el controlador (`AdminController`: incidencias, métricas), pero **no hay pantalla**.
- Abordaje por QR: el pase del pasajero lo escanea el conductor (`qr_pase`) y también existe escanear el QR del bus (`qr_unidad`). Stitch mostraba solo el primero.
- Paleta unificada en azul (Stitch mezclaba azul y verde/teal entre pantallas).
