# CODEBASE-MAP.md — App Eimed CareOps

Mapa de navegación para agentes. Generado por lectura del repo (no ejecuta nada
que escriba datos). Repo en producción: Vercel (frontend) + Supabase (auth + Postgres).
Mantener este archivo compacto; actualizar solo lo que cambie.

## 1. Stack real

- React 19.2 + TypeScript 5.9 (strict) + Vite 8. Router: `react-router-dom` v7 (`BrowserRouter`).
- Fechas: `date-fns` v4 (`format`, `parseISO`, `isWithinInterval`, locale `es`). Fechas se guardan como
  string ISO **sin zona horaria** (`yyyy-MM-dd` o `yyyy-MM-ddTHH:mm`) — nunca usar `new Date(str)` para
  parseo, usar `parseISO`.
- PDFs: `jspdf` + `html2canvas` (render de un `<div>` oculto a canvas → PDF). Excel: `xlsx`. Zips: `jszip`.
- Iconos: `lucide-react`. IDs: `uuid` propio compatible HTTP (ver `src/utils` o buscar helper `uuid()` —
  reemplaza `crypto.randomUUID()`, ver commit `ebc076a`).
- Backend: Supabase (`@supabase/supabase-js`). Tablas `{id: text, data: jsonb}` — un JSON gigante por
  entidad, no columnas normalizadas. Sin ORM/migraciones formales: el schema vive en `supabase_schema.sql`
  (ejecutado manualmente en el SQL Editor de Supabase, no hay migration runner).
- **App de una sola empresa (single-tenant)**: NO existe `empresa_id` ni filtrado multi-tenant en ningún
  lado. Todos los usuarios autenticados ven todos los datos (ver RLS abajo).
- Sin infraestructura de tests (no hay `*.test.*`, no hay script `test` en `package.json`).

## 2. Estructura de carpetas (src/)

- `views/` — una vista por ruta, generalmente monolítica (500–2300 líneas, formularios+lista+modales en
  el mismo archivo). Cada vista trae su propio `.css` homónimo (`Payroll.tsx` + `Payroll.css`).
  - `Dashboard.tsx` resumen general. `Patients.tsx`/`PatientDetail.tsx` (+ `components/patient/*` tabs).
    `Nurses.tsx`/`NurseDetail.tsx`. `Clients.tsx`/`ClientDetail.tsx`. `Catalog.tsx` (servicios/equipo/insumos).
  - `Calendar.tsx` — agenda/turnos (ver §4).
  - `Financials.tsx` — cuentas por cobrar (facturas, recibos de ingreso, alquileres, ventas insumos).
  - `Payroll.tsx` — planillas de pago a enfermeras (ver §4). **ZONA DELICADA**.
  - `Documents.tsx` — documentos/correlativos, usa el legacy `services/db.ts` (ver §3).
  - `Reports.tsx` — reportes por período/sección (operativo, cobros, pagos, alquileres, insumos,
    rentabilidad), consume las mismas claves `useLocalStorage` que las demás vistas, exporta PDF via
    `downloadElementAsPDF`. Candidato natural para vivir junto a un feature de auditoría.
  - `Settings.tsx` — config de empresa, tipos de turno, correlativos, tipos de ajuste, tema, usuarios.
- `components/` — modales y widgets compartidos: `ui/Modal.tsx` (modal genérico), `ui/SearchableCombobox.tsx`,
  `ErrorBoundary.tsx`, `SessionExpiredModal.tsx`, `ImportNursesModal.tsx`, `QuickAddPatientModal.tsx`,
  varios `*Print.tsx`+`*.css` (plantillas para PDF: contrato, factura, recibo, certificados de enfermera,
  horario, cotización).
  - `components/layout/` — `Sidebar.tsx` (menú, rutas) y `TopBar.tsx`.
  - `components/patient/` — tabs del detalle de paciente (datos, cuidado, responsables, servicio, resumen,
    timeline, alertas) + `patient.css`.
- `contexts/` — `AuthContext.tsx` (sesión Supabase, perfil, rol admin/operativo, expiración de sesión) y
  `ThemeContext.tsx` (claro/oscuro, `data-theme` en `<html>`).
- `hooks/` — `useDB.ts` (persistencia real, ver §3), `useLocalStorage.ts` (re-export de `useDB`),
  `useOverlayClose.ts` (cerrar modal/drawer con click fuera o Escape).
- `types/index.ts` — todos los tipos del dominio en un solo archivo (ver §.
- `utils/` — `money.ts` (`toMoney`), `downloadAsPDF.ts`, `generateNursePDF.ts`/`generatePatientPDF.ts`/
  `generateDocumentPDF.ts`, `exportPlanillaToExcel.ts`, `numberToWords.ts` (montos en letras para recibos),
  `payrollAudit.ts` (lógica pura del feature de auditoría de planillas: conciliación calendario↔planillas,
  turnos vencidos, doble pago, validaciones OBSERVADO H13–H20; cubierto por `payrollAudit.test.ts`, 71 tests
  con vitest — script `npm test`).
- `components/ui/Toast.tsx` + `ToastContext.ts` — sistema de avisos global (`useToast`), `ToastProvider`
  montado en `App.tsx`. Usar en lugar de `window.alert` para feedback; `window.confirm` solo para acciones
  que mueven dinero.
- `config/appSettings.ts` — settings globales persistidos (clave `app_settings`).
- `lib/supabase.ts` — cliente Supabase + `isSupabaseConfigured`.
- `services/db.ts` — **capa legacy** (localStorage puro, sin Supabase). Solo lo importa `Documents.tsx`
  hoy. No usar para código nuevo; usar `useLocalStorage`/`useDB`.
- `initialData.ts` — datos semilla/fallback (`INITIAL_PATIENTS`, `INITIAL_NURSES`, `INITIAL_SHIFT_TYPE_DEFS`,
  `INITIAL_COMPANY_INFO`, etc.) usados como `initialValue` de `useLocalStorage` cuando la tabla está vacía.

No hay carpeta `models/`, `services/api`, ni `repositories/`: el "service layer" es el hook `useDB`
llamado directo desde cada vista con la clave de tabla como string.

## 3. Persistencia — `src/hooks/useDB.ts`

`useLocalStorage<T>(key, initialValue)` (alias de `useDB`'s `useLocalStorage`) devuelve `[data, setValue]`
como un `useState` normal, pero:

1. Estado inicial instantáneo desde `localStorage[key]` (evita flash).
2. `useEffect` dispara fetch a Supabase en background y reemplaza el estado.
3. Suscripción realtime (`supabase.channel('db-'+table).on('postgres_changes', ...)`) aplica cambios
   incrementales fila por fila (no refetch completo) para no pisar ediciones en pantalla de otros usuarios.
4. `setValue(nuevoValor | fn)`: escritura **optimista** — actualiza estado + localStorage inmediato, y en
   paralelo hace upsert/delete solo de las filas que cambiaron (diff por `JSON.stringify` contra el valor
   previo) a la tabla Supabase mapeada. Reintenta filas que fallaron (`dirtyIdsRef`) en el próximo guardado.
5. Si `isSupabaseConfigured` es `false`, funciona 100% en localStorage (modo dev sin backend).

`TABLE_MAP` (clave localStorage → tabla Supabase), lo relevante para planillas:
`payrollRuns → payroll_runs`, `payrollAdjustments → payroll_adjustments`,
`payroll_adjustment_types → payroll_adjustment_types`, `shifts → shifts`, `nurses → nurses`,
`patients → patients`, `company_info → company_info` (objeto único, `SINGLE_OBJECT_KEYS`).

Cada fila de Supabase es `{id, data: <objeto TS completo>}` — no hay columnas para campos individuales,
por lo que filtrar/agregar en el backend (SQL) no es viable sin cambiar el schema; todo el filtrado ocurre
en el cliente sobre los arrays ya cargados.

**RLS** (`supabase_schema.sql` §5): `shifts` — cualquier autenticado lee y escribe. **Todas las demás
tablas (incluyendo `payroll_runs`, `payroll_adjustments`)** — cualquier autenticado lee, **solo admins
escriben** (`public.is_admin()` chequea `profiles.role = 'admin'`). Un feature de auditoría de planillas
que solo lee no necesita cambios de RLS; si escribe algo nuevo (p.ej. tabla de hallazgos de auditoría),
replicar el patrón "todos leen / solo admin escribe" o decidir explícitamente lo contrario.

## 4. Modelo de datos clave (`src/types/index.ts`)

- **`Shift`** (turno): `patient_id`, `nurse_id`, `shift_type_id: ShiftType` (`DAY|NIGHT|H24|HOURLY`),
  `start_at`/`end_at` (ISO), `status: ShiftStatus` (`scheduled|confirmed|completed|cancelled|replaced|
  incident`), `pay_amount` (a pagar a la enfermera), `bill_amount` (a cobrar al cliente),
  `payroll_included?: boolean` + `payroll_run_id?: string` (marca si ya fue tomado por una planilla),
  `duration_hours?` (solo `HOURLY`), campos de doble pago H24 (`is_double_pay`, `h24_day_portion*`).
- **`ShiftTypeDef`** (config, tabla `shiftTypeDefs`): catálogo de tipos de turno con `default_charge`/
  `default_cost`/`duration_hours`/`default_start_time` por defecto.
- **`Patient.active_service.shift_tariffs`**: `{ [shift_type_id]: { charge, cost } }` — tarifa específica
  del paciente por tipo de turno, tiene prioridad sobre el default del `ShiftTypeDef`.
- **`Nurse`**: `base_rate`, `pending_payment`, `bank_info`, `payment_method`.
- **`PayrollRun`** (tabla `payrollRuns`): `payroll_number`, `period_start/end`, `nurse_id`, totales por
  tipo de turno, `gross_amount`/`deduction_amount`/`net_amount`, `status: PayrollStatus`
  (`draft|calculated|approved|paid|void`), `items: PayrollItem[]`, `payment_info` (fecha/método/referencia
  al pagar), `receipt_id`.
- **`PayrollItem`**: línea de un `PayrollRun` — referencia `shift_id` (o `'ADJ'` si es un ajuste),
  `pay_rate`, `amount`.
- **`PayrollAdjustment`** (tabla `payrollAdjustments`): bono/descuento suelto por enfermera y período,
  con `applied_payroll_id` una vez consumido por un `PayrollRun`, `status: pending|applied|cancelled`.
- **`AdjustmentType`**: catálogo (`addition`/`deduction`) configurable en Settings.
- **`Receipt`**: recibo formal ligado a un `PayrollRun` (no siempre se usa; `Payroll.tsx` a veces genera
  `receipt_id` inline sin fila en tabla `receipts`, ver `handleIssueReceipt`).

Relación: `Shift.payroll_run_id` → `PayrollRun.id` → `PayrollRun.items[].shift_id` → `Shift.id` (doble
enlace, ambos deben mantenerse consistentes al crear/anular una planilla).

## 5. Flujo de negocio: Calendario y Planillas

### Calendario (`src/views/Calendar.tsx`, ~1500 líneas)
- Grid mensual/timeline, filtros por paciente/enfermera/estado/tipo de turno.
- `ShiftForm` (componente interno, línea ~1164) crea/edita turnos. **`resolveAmounts(patientId, typeId)`**
  (línea ~1170) resuelve `pay_amount`/`bill_amount`/horario con esta prioridad:
  `Patient.active_service.shift_tariffs[typeId]` → `ShiftTypeDef.default_cost/charge` → fallback
  hardcodeado (`cost 50 / charge 80`). El resultado expone `source: 'patient'|'default'|'fallback'` que
  se muestra en la UI como badge de origen de tarifa — reutilizar esta función/lógica para cualquier
  feature que necesite "cuánto debería costar este turno".
- Cambiar `status` a `completed` es el gatillo para que el turno sea elegible en Planillas. Turnos con
  `payroll_included: true` ya fueron tomados por una planilla activa.

### Planillas (`src/views/Payroll.tsx`, ~2300 líneas) — **ZONA DELICADA**
- `NewPayrollWizard` (línea ~2094): dado un rango de fechas, filtra `shifts` con `status === 'completed'`
  dentro del rango y `!payroll_included` (o huérfanos: `payroll_included` pero apuntando a un
  `payroll_run_id` que ya no existe en `payrollRuns` — se liberan automáticamente). Agrupa por `nurse_id`,
  calcula `gross_amount` sumando `pay_amount` de cada turno (con fallback hardcodeado por tipo si
  `pay_amount` es 0), aplica `PayrollAdjustment`s pendientes de esa enfermera, crea un `PayrollRun` por
  enfermera con `status: 'calculated'` y marca los turnos usados con `payroll_included: true` +
  `payroll_run_id`.
- Ciclo de vida de `PayrollRun.status`: `calculated → approved (handleApprove) → paid (handleRegisterPayment,
  requiere payment_info) `, o `→ void (handleVoid, libera los turnos)`. Ver funciones en línea ~370-415.
- Recibos PDF individuales y en lote (ZIP con `jszip`) generados client-side desde `PayrollRun` +
  `CompanyInfo`, sin persistir el PDF en Supabase Storage (se descarga directo).
- Exportación a Excel: `src/utils/exportPlanillaToExcel.ts`.
- Commits recientes (`git log -- src/views/Payroll.tsx`) muestran que este archivo tiene alta tasa de
  bugfixes (turnos huérfanos, UUIDs, fechas por defecto, doble pago H24) — es zona sensible y con datos
  reales de pagos a enfermeras en producción. Cualquier cambio debe preservar la invariante
  turno↔`payroll_run_id`↔`payroll_included` y no debe reprocesar montos ya `approved`/`paid` sin
  confirmación explícita.

## 6. Sistema de diseño

- Variables CSS en `src/index.css` (paleta `--primary-*`, `--secondary-*`, `--success/warning/error-*`,
  `--bg-main`, `--bg-card`, `--text-main`, `--text-muted`, espaciados `--spacing-*`, radios `--radius-*`,
  sombras `--shadow-*`). Modo oscuro vía `:root[data-theme="dark"]` (mismos nombres de variable,
  redefinidos) — controlado por `ThemeContext.tsx`, toggle en Settings. **Usar siempre variables, nunca
  colores hardcodeados**, para que el feature nuevo respete el modo oscuro automáticamente.
- `src/App.css` — layout general (`.app-layout`, `.main-content`, `.view-viewport`).
- Componentes UI reutilizables: `components/ui/Modal.tsx` (overlay+drawer genérico, usar para
  formularios/detalles), `components/ui/SearchableCombobox.tsx` (selector con búsqueda), badges de estado
  vía clases `badge` + modificador (`badge approved`, `badge paid`, `badge void`, `badge calculated`, ver
  `Payroll.tsx` líneas ~793-1035 para el patrón), `action-menu-dropdown` (menú de acciones por fila),
  `table-wrapper` (scroll horizontal en tablas dentro de móvil).
- Patrón responsive: tabla en desktop + tarjetas en móvil, implementado por vista (mismo componente,
  distinto layout via CSS breakpoints) — ver `Payroll.css`, `Financials.tsx`, `Catalog.tsx`, `Nurses.tsx`,
  `Clients.tsx`, `Patients.tsx` para el patrón ya adoptado (commits `e924074`, `e6550b0`).

## 7. Convenciones

- UI 100% en español (labels, mensajes, `alert()`/`window.confirm()` para confirmaciones simples).
- Dinero: siempre redondear con `toMoney()` (`src/utils/money.ts`, `Math.round(n*100)/100`) antes de
  guardar/sumar montos — usado en Payroll y Financials.
- Fechas: `date-fns` `format`/`parseISO` con locale `es`; nunca `Date` nativo para parseo de strings ISO
  guardados (evita corrimiento de zona horaria).
- IDs: `uuid()` helper propio (no `crypto.randomUUID()` directo — hay entornos HTTP sin ese API).
- Rutas nuevas se registran en `src/App.tsx` (lazy `import()`) y en el menú `src/components/layout/
  Sidebar.tsx` (array de items con `icon`/`label`/`path`).
- Cada vista trae sus propios estados de carga vía `useLocalStorage`, no hay un store global (Redux/Zustand)
  ni React Query — todo el "cache" vive en las claves de `useDB`.

## 8. Infraestructura de calidad

- `npm run dev` — Vite dev server.
- `npm run build` — `tsc -b && vite build` (typecheck estricto + build; falla si hay errores TS).
- `npm run lint` — `eslint .` (config plano en `eslint.config.js`: `@eslint/js` + `typescript-eslint` +
  `react-hooks` + `react-refresh`; `noUnusedLocals`/`noUnusedParameters` están **desactivados** en
  `tsconfig.app.json`, así que el linter no bloqueará por variables sin usar).
- `npm run preview` — sirve el build de producción localmente.
- **No hay tests automatizados** (ni unit ni e2e). Verificación manual + `tsc`/`eslint` son la única red
  de seguridad antes de deploy (Vercel hace build on push).

## 9. Dónde debería vivir un feature de "auditoría de planillas"

- Vista nueva sugerida: `src/views/PayrollAudit.tsx` (o una pestaña/sección dentro de `Payroll.tsx` si es
  pequeño) + registrar ruta en `App.tsx` (lazy) y entrada en `Sidebar.tsx`. Alternativa: sub-sección dentro
  de `Reports.tsx` si es solo lectura/reportería (ese archivo ya tiene el patrón de secciones con período).
- Reutilizar: `useLocalStorage('payrollRuns', ...)`, `useLocalStorage('shifts', ...)`,
  `useLocalStorage('payrollAdjustments', ...)`, `useLocalStorage('nurses', ...)` — NO crear una tabla
  paralela para leer los mismos datos.
- Si necesita persistir hallazgos/observaciones de auditoría, crear una clave nueva en `TABLE_MAP`
  (`src/hooks/useDB.ts`) + tabla correspondiente en `supabase_schema.sql` (mismo patrón `{id, data jsonb}`
  + RLS "todos leen / admin escribe"), siguiendo el mismo estilo que `payroll_adjustments`.
- Reutilizar `toMoney()` para cualquier cálculo de diferencia/discrepancia de montos, `Modal` para el
  detalle de una discrepancia, badges/`table-wrapper` para listar hallazgos, y el mismo patrón
  desktop-tabla/móvil-tarjeta que el resto de la app.
- La lógica de "qué debería costar un turno" ya existe (`resolveAmounts` en `Calendar.tsx`) — una
  auditoría de planillas que compare `pay_amount` real vs. esperado debería reimplementar/exportar esa
  misma prioridad (paciente → catálogo → fallback) para no divergir del cálculo que usa el calendario.

## 10. ZONAS DELICADAS — no tocar sin cuidado extremo

- **`src/views/Payroll.tsx`**: pagos reales a enfermeras en producción. `handleApprove`,
  `handleRegisterPayment`, `handleVoid`, `NewPayrollWizard.handleProcess` mutan `payrollRuns` y `shifts`
  a la vez (invariante `payroll_included`/`payroll_run_id`). Un feature de auditoría debe ser
  **estrictamente de lectura** sobre estas estructuras salvo que el usuario pida explícitamente que
  también corrija datos.
- **`src/hooks/useDB.ts`**: motor de sincronización optimista + realtime. Ya tuvo bugs de datos pisados
  entre usuarios (commit `9da6367`). No modificar su lógica de diffing/generaciones sin entender a fondo
  `pendingWritesRef`/`writeGenRef`/`dirtyIdsRef`.
- **Correlativos de documentos** (`document_correlatives`, `system_correlatives`): la memoria del usuario
  indica que "facturación es solo interna, correlativos duplicados no son urgentes" — no es zona crítica
  legal (sin Hacienda), pero sigue siendo dato compartido entre usuarios concurrentes.
- **Tablas con datos reales de producción** (todas bajo `TABLE_MAP` en `useDB.ts`): `patients`, `nurses`,
  `shifts`, `payroll_runs`, `payroll_adjustments`, `invoices`, `clients`, etc. — cualquier `setValue` con
  un array incompleto sobreescribe (con diff, pero igual) filas reales; probar primero contra
  `localStorage`/staging si es posible antes de escribir código que llame `setPayrollRuns`/`setShifts`
  en bulk.

## Preguntas abiertas (no asumidas)

- No se encontró documentación explícita de qué debería considerarse "discrepancia" en una auditoría de
  planillas (¿turno con `pay_amount` distinto al resuelto por `resolveAmounts`? ¿enfermera pagada dos
  veces por el mismo turno? ¿ajustes aplicados fuera de período?) — se necesita el PRD del feature para
  confirmar el alcance exacto antes de diseñar la vista.
- `Receipt` (tabla `receipts`/`income_receipts` en Supabase) parece infrautilizada: `Payroll.tsx` genera
  `receipt_id` como string suelto (`handleIssueReceipt`) sin necesariamente crear una fila en la tabla
  `receipts` — no quedó confirmado si existe otro flujo que sí la usa; verificar antes de asumir que
  `Receipt` es la fuente de verdad de recibos emitidos.
