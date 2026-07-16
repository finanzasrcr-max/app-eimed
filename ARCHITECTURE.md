# ARCHITECTURE — Auditoría y Control de Planillas

> **Modo INTEGRACIÓN.** App EIMED CareOps en PRODUCCIÓN (Vercel + Supabase). NO se crea esqueleto,
> NO se reestructura, NO se cambia el stack. Este documento define **cómo encaja este feature
> (H1–H20) en la arquitectura existente** descrita en `CODEBASE-MAP.md`. Solo cubre el feature de
> auditoría/control de planillas; el resto de la app no se toca.
>
> **Fuentes:** `STORIES.md` (H1–H20 + P-1…P-12), `Cambios solicitados/PLAN-PLANILLAS-15072026.md`,
> lectura directa de `src/views/Payroll.tsx`, `src/views/Calendar.tsx`, `src/types/index.ts`,
> `src/utils/money.ts`.

---

## 0. Principios de integración (no negociables)

1. **Solo lectura sobre pagos.** La auditoría (conciliación, OBSERVADO, doble pago, vencidos) **deriva**
   de `shifts` + `payrollRuns` ya en memoria. No inventa tablas ni persiste hallazgos. OBSERVADO se
   **calcula en vivo**; no se guarda.
2. **OBSERVADO nunca bloquea** (P-3). Marca el renglón/planilla y pide **una confirmación extra** al
   aprobar. Un admin no técnico nunca queda trabado por una falsa alarma.
3. **Ningún turno realizado sin pagar en silencio.** La conciliación calendario↔planilla es la red
   principal; los avisos son de alta visibilidad pero no interrumpen el flujo salvo cuando el riesgo
   es duplicar dinero (forzar reproceso, aprobar con observaciones).
4. **Compatibilidad hacia atrás total.** Turnos y planillas históricos no traen campos nuevos: **toda
   función tolera `undefined`**. Cero campos nuevos obligatorios; si algo se persistiera, es un campo
   **opcional** dentro del `data` JSON existente (nunca renombrar/eliminar).
5. **Lógica nueva en módulos puros y testeables** (`src/utils/payrollAudit.ts`), fuera de la UI. Las
   vistas solo llaman funciones puras y renderizan. `Payroll.tsx` (ZONA DELICADA) se toca lo mínimo.
6. **Sin dependencias npm nuevas.** Todo se hace con lo instalado (`date-fns`, `toMoney`, React).
7. **TypeScript strict, UI en español, móvil primero** (patrón tabla-desktop / tarjeta-móvil ya
   existente). `tsc -b && vite build` debe seguir pasando.

---

## 1. Decisiones sobre las 12 preguntas abiertas

Se **adoptan las recomendaciones del analista** salvo matices reforzados para minimizar falsas
alarmas (perfil: admin no técnico que opera desde el teléfono). Todos los umbrales viven como
**constantes con nombre** en `payrollAudit.ts` para calibrarlas sin tocar lógica.

| # | Pregunta | Decisión | Por qué |
|---|----------|----------|---------|
| **P-1** | Rango histórico: ¿min–max estricto o ±%? (H13) | **min–max estricto, pero solo si hay ≥ `MIN_HISTORIAL` (=3) turnos pagados** de ese paciente+tipo. Con menos historial, comparar contra la tarifa configurada (P-4) con tolerancia `±TOL_TARIFA` (=10%). Sin ninguna referencia → OBSERVADO "sin tarifa de referencia". | Con 1–2 datos el min–max estricto dispara falsas alarmas (riesgo que el propio plan señala). Exigir historial mínimo lo evita sin perder la caza de anómalos reales. |
| **P-2** | Período con realizados pero SIN planillas: ¿estado? (H5) | Si `pendientes > 0` → **INCOMPLETO**, aunque no exista ninguna planilla (hoy `getPeriodStatus` con 0 runs devuelve `borrador`). | La alerta debe salir desde el primer turno realizado sin procesar; `borrador` oculta el problema (raíz de julio). |
| **P-3** | ¿OBSERVADO bloquea? (H17) | **No bloquea.** Solo confirmación extra al aprobar (`window.confirm` que enumera observaciones). | Regla explícita del plan; el admin nunca queda trabado. |
| **P-4** | Sin historial ni tarifa: ¿referencia? (H13–H15) | Cadena: **historial → tarifa del paciente (`shift_tariffs[tipo].cost`) → catálogo (`ShiftTypeDef.default_cost`)**. Si ninguna existe → OBSERVADO `SIN_TARIFA_REFERENCIA` (no se inventa número). | Reutiliza la misma prioridad que `resolveAmounts` de Calendar; no diverge del cálculo real y no asume montos. |
| **P-5** | ¿Qué planillas cuentan como "enPlanilla"? (H4) | **Cualquier planilla NO `void`** (`draft`/`calculated`/`approved`/`paid`). Solo `void` libera el turno. | El turno ya tiene `payroll_included=true`; un `draft` a medio hacer sí cubre el turno. Coherente con la invariante y con H1. |
| **P-6** | Alcance temporal (H6, H12) | **Conciliación** (H4/H12): por período **navegado, sin límite** (es liviana, O(turnos del período)). **Vencidos** (H6): limitados a `HORIZONTE_VENCIDOS_MESES` (=12) hacia atrás. | Conciliación por período no pesa; la lista global de vencidos sin límite traería ruido antiguo y costo en el teléfono. |
| **P-7** | Ajustes sin período/fecha (H20) | Ajustes **con** `period_start/end` o `date` dentro del rango → se aplican a ese período. Ajustes **sin** fecha asignable → van a un apartado **"Ajustes sin período — aplicar manualmente"** en el resumen previo; **nunca** se aplican en silencio. | Evita arrastrar ajustes viejos a la planilla equivocada; deja la decisión al admin sin sorpresas. |
| **P-8** | Comparaciones de tope: ¿estrictas o con margen? (H14, H15, H18) | Margen de tolerancia `TOL_MONTO` (=$1 absoluto). Helper `superaCon(a, b) = a > b + TOL_MONTO`. | Evita OBSERVADO por centavos de redondeo. Un peso es imperceptible frente a tarifas de $50–$110. |
| **P-9** | Turnos que cruzan medianoche (H15, H18) | **Traslape y tope de 24h de enfermera (H18): por rango real** `start_at`–`end_at`. **Suma del día por paciente (Control B, H15): por día de inicio** del turno (documentado). | El traslape físico exige horas reales; la suma-día es una heurística de negocio que se ancla al día de inicio para ser predecible. |
| **P-10** | Pago > cobro sin cobro definido (H19) | Marcar solo si **`bill_amount > 0` y `pay_amount > bill_amount`**. Si no hay cobro (`0`/ausente), NO marcar. | Un turno aún sin facturar daría margen negativo falso. |
| **P-11** | Mecanismo de aviso (H2, H3, H7, H8) | **Toast ligero propio** (`components/ui/Toast.tsx` + `ToastContext`) para éxitos no bloqueantes (aprobar, pagar, anular, cambio de estado en agenda). **`window.confirm`** se reserva para lo que sí debe interrumpir: forzar reproceso (H8) y aprobar con OBSERVADO (H17). Cero dependencias nuevas. | La app no tiene toasts; es el mínimo consistente con el diseño (variables CSS, modo oscuro). |
| **P-12** | Reproceso manual julio 2026 (operativo) | **Tras** desplegar H1: abrir "Procesar Período" 01–15/07, revisar vista previa, procesar los "listos", **sin** "Forzar reprocesamiento". Manual y supervisado. | H1 ya libera los huérfanos de anulaciones; sin force no se duplica. Sin código. |

**Constantes de calibración** (todas en `payrollAudit.ts`, un solo lugar):

```ts
export const MIN_HISTORIAL = 3;              // P-1: turnos pagados mínimos para usar min–max
export const TOL_TARIFA = 0.10;              // P-1: ±10% contra tarifa configurada si falta historial
export const TOL_MONTO = 1;                  // P-8: margen $1 en comparaciones de tope
export const HORIZONTE_VENCIDOS_MESES = 12;  // P-6: antigüedad máxima de vencidos
```

---

## 2. Dónde vive cada pieza

### 2.1 Módulos NUEVOS (lógica pura, sin UI — testeable)

| Archivo | Responsabilidad | Depende de |
|---------|-----------------|------------|
| `src/utils/payrollAudit.ts` | **Núcleo.** Conciliación, validaciones OBSERVADO, doble pago, vencidos, resolución de tarifa esperada, rango histórico. Funciones puras (entrada→salida, sin `useLocalStorage`, sin React). | `types`, `toMoney`, `date-fns` |
| `src/hooks/usePayrollAudit.ts` | **Wiring + memoización.** Lee `shifts`/`payrollRuns`/`patients`/`shiftTypeDefs`/`adjustments` vía `useLocalStorage` y expone resultados memoizados para un período dado. NO contiene reglas de negocio (solo llama a `payrollAudit.ts`). | `payrollAudit.ts`, `useLocalStorage` |
| `src/components/ui/Toast.tsx` + `ToastContext` | Toast no bloqueante reutilizable (éxito/info/error). | `index.css` (variables) |

> **Por qué hook además de utils:** varias piezas de UI necesitan los mismos derivados para el período
> activo (banner H4, estado INCOMPLETO H5, doble pago H8, vencidos H6, observaciones por planilla
> H13–H19). El hook centraliza el `useMemo` y evita recalcular por componente. La **regla** vive en
> `utils` (pura, testeable); el hook solo enchufa datos. Si en la práctica una sola vista lo consume,
> el hook es opcional y puede colapsarse en un `useMemo` dentro de `Payroll.tsx` — pero se recomienda
> el hook por claridad y reuso (Calendar también consume `validarTurno`).

### 2.2 `src/views/Payroll.tsx` (ZONA DELICADA — cambios MÍNIMOS)

Todos los cambios preservan la invariante `shift.payroll_run_id ↔ run.items[].shift_id ↔
shift.payroll_included` y no reprocesan montos `approved`/`paid` sin confirmación.

| Historia | Cambio puntual | Línea de referencia |
|----------|----------------|---------------------|
| **H1** | `handleVoid`: además de `status:'void'`, liberar turnos como hace `handleDelete` (poner `payroll_included:false`, `payroll_run_id:undefined` en los ítems no-`ADJ`). Filtrar `status==='void'` en los dos `activeRunIds` del wizard. | `:406`, `:2119`, `:2147` |
| **H2** | Derivar `selectedPayroll` **por id desde `payrollRuns`** en el render (no guardar copia en state), para que el badge y los botones se actualicen en vivo. Disparar toast en `handleApprove`/`handleRegisterPayment`/`handleVoid`. | `:82`, `:1598`, `:370`, `:385`, `:406` |
| **H4** | Banner rojo derivado de `conciliarPeriodo(...)` del período activo. Botones "Ver turnos" (H11) y "Procesar ahora" (abre wizard con fechas del período). Solo lectura. | nuevo, sobre `periodRuns`/`activePeriod` |
| **H5** | Ampliar `getPeriodStatus` para recibir `pendientes`; añadir meta **`incompleto`** a `PERIOD_STATUS_META` (naranja/`--warning`). `pendientes>0` ⇒ `incompleto` aunque `runs.length===0` (P-2). | `:186`, `:196` |
| **H6** | Sección/alerta de vencidos desde `turnosVencidos(...)`, lista en tarjetas móviles; acciones "Marcar Realizado / Cancelado / ir a agenda". | nuevo |
| **H8** | Alerta crítica roja desde `detectarDoblePago(payrollRuns)`. `window.confirm` explícito antes de activar `forceReprocess`. | `:2110`, `:2162` |
| **H9** | En el `map` de `selectedPayroll.items`, resolver `getPatientName(shift.patient_id)`, mostrar tipo, tarifa/monto y marca OBSERVADO+motivo. `ADJ` sin paciente. Tolerar turno inexistente ("Paciente no encontrado"). | `:1653`–`:1732` |
| **H10** | Resumen por paciente (agrupación en memoria sobre `items` resolviendo paciente por turno). `ADJ` aparte. | nuevo, en el detalle |
| **H11** | Lista de pendientes (misma fuente que H4) en tarjetas; "Procesar ahora" abre wizard. | nuevo |
| **H12** | La conciliación no debe estar cableada al período actual: se evalúa por período navegado. **Ampliar `availablePeriods`** para incluir también períodos con turnos `completed` aunque no tengan planillas (hoy solo lista período actual + los que tienen runs, `:156`) — si no, no se puede navegar a un mes viejo sin planilla. | `:156` |
| **H13–H19** | Columna "Alertas" (hoy vacía, `:747`) renderiza `validarPlanilla(run,...)`. Detalle muestra motivos por turno. | `:747`, detalle |
| **H16** | Reemplazar el `calculateRate` hardcodeado (`50/60/110/0`) por `resolverTarifaEsperada(...)` del catálogo, en **los dos** sitios: `handleRecalculate` (`:424`) y `NewPayrollWizard.handleProcess` (`:2183`). Turno con pago $0 / sin tarifa ⇒ OBSERVADO (no se paga $0 en silencio). | `:424`, `:2183` |
| **H17** | En `handleApprove`: si `validarPlanilla` devuelve observaciones, `window.confirm` que las enumera antes de aprobar. Sin observaciones, aprueba directo. | `:370` |
| **H20** | En el wizard, filtrar `adjustments` por período (usar `period_start/end` o `date` en rango) en vez de "todos los pendientes". Ajustes sin fecha → apartado manual (P-7). Detallar ajustes aplicados en el resumen previo. | `:2192`, `:208` |

> **Regla de oro de esta zona:** cada `setShifts`/`setPayrollRuns` sigue el patrón existente
> (`setValue(prev => prev.map(...))`, escritura optimista de `useDB`). No se introducen escrituras en
> bulk nuevas salvo las de H1 (que replican exactamente `handleDelete`, ya probado).

### 2.3 `src/views/Calendar.tsx` (cambios MÍNIMOS)

| Historia | Cambio | Línea |
|----------|--------|-------|
| **H3** | Tras cambiar estado (confirmar/realizado/cancelar/reemplazar), actualizar `selectedShift` en vivo y disparar toast. Hoy "Marcar Realizado" cierra el panel (`setSelectedShift(null)`); mantener cierre pero con toast de confirmación. | `:840`, `:854`, `:863`, `:873` |
| **H7** | Al "Marcar Realizado", si la fecha del turno cae en un período con al menos una planilla `paid`, toast/aviso: "Este turno quedó fuera de la planilla ya pagada; el período volverá a INCOMPLETO hasta que lo procese". | `:873` |
| **H14/H15** | En el `ShiftForm`, al calcular `pay_amount` por hora o al programar el 2º turno del día del paciente, mostrar aviso inline (no bloqueante) usando `validarTurno(...)` del mismo `payrollAudit.ts`. | `ShiftForm` `:1164`+ |

> **`resolveAmounts` (Calendar `:1170`) y `resolverTarifaEsperada` (utils) deben coincidir en
> prioridad** (paciente → catálogo → fallback). Se recomienda que Calendar importe la versión de
> `payrollAudit.ts` para no divergir; si se deja el helper local, mantener idéntica la cadena.

### 2.4 Registro / montaje

- `ToastProvider` se monta **una vez** en `src/App.tsx`, envolviendo el árbol (junto a `AuthContext`/
  `ThemeContext`). El toast se renderiza en un contenedor fijo (`position: fixed; bottom`) con
  `z-index` por encima de modales.
- **No** se crea vista/ruta nueva ni entrada de Sidebar: todo el feature vive **dentro de Planillas y
  Calendario** (regla de oro del plan: "la revisión se hace sin salir de Planillas"). El
  `CODEBASE-MAP §9` sugería una vista `PayrollAudit.tsx` como opción; se **descarta** a favor de la
  integración en `Payroll.tsx`, porque el PRD pide banners/columna Alertas/detalle en el flujo actual.

---

## 3. Sistema de avisos (Toast)

**Decisión:** componente propio mínimo, cero dependencias.

- `components/ui/Toast.tsx`: `ToastContext` + `ToastProvider` + hook `useToast()` que expone
  `toast.success(msg)`, `toast.error(msg)`, `toast.info(msg)`.
- Render: pila de toasts en contenedor `fixed`, auto-descarte a ~3–4 s, descartable al tocar
  (legible en móvil, no depende de hover).
- Estilo: **solo variables CSS existentes** (`--success-*`, `--error-*`, `--warning-*`, `--bg-card`,
  `--text-main`, `--radius-*`, `--shadow-*`) ⇒ respeta modo oscuro automáticamente.
- **Uso:**
  - Éxito no bloqueante: H2 (aprobar/pagar/anular), H3 (estado de turno), H7 (aviso al marcar tarde).
  - Bloqueante (`window.confirm`, se conserva): H8 (forzar reproceso), H17 (aprobar con OBSERVADO).
- **Regla de fallo:** si el guardado falla, **no** se muestra toast de éxito y el estado no cambia
  (H2/H3 caso borde). Como `useDB` es optimista, el toast se dispara tras invocar `setValue`; si más
  adelante se requiere confirmación de red, se envuelve en try/catch — hoy basta el patrón optimista
  ya usado en el resto de la app.

Firma:

```ts
interface ToastApi {
  success(mensaje: string): void;
  error(mensaje: string): void;
  info(mensaje: string): void;
}
export function useToast(): ToastApi;
```

---

## 4. Compatibilidad de datos

- **Turnos/planillas históricos sin campos nuevos:** todas las funciones tratan `undefined` como
  "no configurado". Ej.: `pay_amount ?? 0`, `bill_amount ?? 0`, `duration_hours ?? 0`,
  `payroll_included ?? false`, `status` de planilla siempre presente pero se filtra `void` explícito.
- **Dinero:** toda diferencia/suma/comparación pasa por `toMoney` antes de comparar o mostrar. Las
  comparaciones de tope usan el margen `TOL_MONTO` (P-8).
- **Fechas:** `parseISO`/`format` de `date-fns` (ISO local sin zona). **Nunca** `new Date(str)` para
  parsear strings guardados. Para "día calendario" (Control B, agrupación por día) se usa
  `format(parseISO(s.start_at), 'yyyy-MM-dd')`.
- **Cero campos nuevos obligatorios.** OBSERVADO se calcula en vivo, **no se persiste** ⇒ no hay
  migración ni campo nuevo. Si en el futuro se quisiera recordar "observación aceptada por el admin",
  se añadiría un **opcional** `observaciones_ack?: boolean` dentro de `PayrollRun` (`data` JSON),
  compatible hacia atrás; **no se hace en esta iteración** (H17 solo confirma, no recuerda).
- **`PayrollAdjustment` ya trae `period_start?`, `period_end?`, `date`, `status?`** (`types:298-300`)
  ⇒ H20 no requiere campos nuevos, solo usar los existentes al filtrar por período.

---

## 5. Contratos de las funciones clave (`src/utils/payrollAudit.ts`)

Tipos de salida (mensajes en **español, listos para mostrar**):

```ts
export type ObservacionCodigo =
  | 'RANGO_HISTORICO'          // H13
  | 'TARIFA_HORA_PROYECTADA'   // H14 (tarifa/hora ×24 > H24)
  | 'SUMA_DIA_PACIENTE'        // H15 (suma del día del paciente > H24)
  | 'SIN_TARIFA'               // H16 (pago $0 / sin tarifa)
  | 'SIN_TARIFA_REFERENCIA'    // P-4 (no hay historial ni tarifa)
  | 'ENFERMERA_24H'            // H18 (>24h en un día)
  | 'ENFERMERA_TRASLAPE'       // H18 (turnos solapados)
  | 'PAGO_MAYOR_COBRO'         // H19 (margen negativo)
  | 'DOBLE_PAGO';              // H8 (crítico)

export interface Observacion {
  codigo: ObservacionCodigo;
  mensaje: string;                          // p.ej. "Pago fuera del rango histórico ($50–$60)"
  shiftIds: string[];                       // turnos involucrados (resaltar renglón)
  severidad: 'observado' | 'critico';       // 'critico' = doble pago (rojo)
}
```

### 5.1 Conciliación (H4/H5/H11/H12)

```ts
export interface ConciliacionResultado {
  realizados: Shift[];   // status==='completed' con start_at dentro del período
  enPlanilla: Shift[];   // realizados cubiertos por una planilla NO void (P-5)
  pendientes: Shift[];   // realizados − enPlanilla
}
export function conciliarPeriodo(
  shifts: Shift[],
  runs: PayrollRun[],
  periodStart: string,   // ISO 'yyyy-MM-dd'
  periodEnd: string,     // ISO 'yyyy-MM-dd' (se extiende a 23:59:59, como el wizard :2117)
): ConciliacionResultado;
```
Reglas: `cancelled`/`replaced` no cuentan como realizados. Un realizado con `payroll_run_id` que
apunta a una planilla `void` (o inexistente) cuenta como **pendiente** (coherente con H1).

### 5.2 Turnos vencidos (H6)

```ts
export function turnosVencidos(
  shifts: Shift[],
  hoy: Date,
  horizonteMeses?: number,   // default HORIZONTE_VENCIDOS_MESES (12)
): Shift[];   // start_at < hoy, status in {scheduled,confirmed,replaced,incident}, dentro del horizonte
```

### 5.3 Doble pago (H8)

```ts
export interface DoblePago { shiftId: string; runs: PayrollRun[]; }
export function detectarDoblePago(runs: PayrollRun[]): DoblePago[];
// Agrupa por shift_id todos los items (shift_id!=='ADJ') de planillas status!=='void'.
// Devuelve los shift_id presentes en 2+ planillas vigentes. severidad 'critico'.
```

### 5.4 Tarifa esperada y rango histórico (H13/H16, P-1/P-4)

```ts
export function resolverTarifaEsperada(
  patient: Patient | undefined,
  shiftTypeId: ShiftType,
  shiftTypeDefs: ShiftTypeDef[],
): { pay: number; charge: number; source: 'patient' | 'catalog' | 'none' };
// Prioridad idéntica a resolveAmounts de Calendar: shift_tariffs[tipo] → ShiftTypeDef → 'none'.

export function rangoHistorico(
  paidShifts: Shift[],      // turnos de planillas status==='paid'
  patientId: string,
  shiftTypeId: ShiftType,
): { min: number; max: number; n: number } | null;   // null si n < MIN_HISTORIAL
```

### 5.5 Validación por turno y por planilla (H13–H19)

```ts
export interface ContextoValidacion {
  patients: Patient[];
  shiftTypeDefs: ShiftTypeDef[];
  paidShifts: Shift[];        // historial de turnos ya pagados (rango histórico H13)
  sameContextShifts: Shift[]; // universo para agrupar por día (paciente H15 / enfermera H18)
}

// Observaciones intrínsecas del turno + las que dependen de su día/contexto.
// Usada por Calendar (avisos H14/H15 al programar) y por validarPlanilla.
export function validarTurno(shift: Shift, ctx: ContextoValidacion): Observacion[];

// Recorre run.items no-ADJ, resuelve cada shift y agrega:
//  - validarTurno por turno (H13/H14/H16/H19)
//  - controles de agrupación día (H15 paciente, H18 enfermera) sobre el conjunto
// Devuelve las observaciones de TODA la planilla (para columna Alertas y confirmación H17).
export function validarPlanilla(
  run: PayrollRun,
  shifts: Shift[],
  ctx: ContextoValidacion,
): Observacion[];
```

**Detalle de cada control:**

- **H13 `RANGO_HISTORICO`**: `r = rangoHistorico(...)`. Si `r` (≥3 pagados): OBSERVADO si
  `monto < r.min` o `monto > r.max` → `"Pago fuera del rango histórico ($min–$max)"`. Si `r===null`:
  comparar contra `resolverTarifaEsperada().pay` con `±TOL_TARIFA`; si `source==='none'` →
  `SIN_TARIFA_REFERENCIA`.
- **H14 `TARIFA_HORA_PROYECTADA`** (solo `HOURLY`): `tarifaHora = pay_amount / duration_hours`.
  `h24Ref = resolverTarifaEsperada(paciente,'H24',...).pay`. OBSERVADO si
  `superaCon(tarifaHora*24, h24Ref)` **o** `superaCon(pay_amount, h24Ref)` →
  `"A $X/hora, 24 horas costarían $Y, más que el H24 ($Z)"`.
- **H15 `SUMA_DIA_PACIENTE`**: agrupar por `patient_id` + día de inicio (P-9). Con ≥2 turnos
  (no `cancelled`/`replaced`), si `superaCon(Σpay, h24Ref)` → **todos** OBSERVADO →
  `"Los turnos de este día suman $X, más que cubrir las 24 horas con un H24 ($Y)"`.
- **H16 `SIN_TARIFA`**: `pay_amount` ausente/0 y sin tarifa resoluble → `"Turno sin tarifa
  configurada"`. (Además, el fallback de cálculo sale del catálogo, no de `50/60/110`.)
- **H18 `ENFERMERA_24H` / `ENFERMERA_TRASLAPE`**: agrupar por `nurse_id` + día real (P-9). Si
  Σhoras > 24 (con `TOL_MONTO` análogo en horas) o dos rangos `start_at`–`end_at` se solapan →
  todos OBSERVADO con motivo.
- **H19 `PAGO_MAYOR_COBRO`**: solo si `bill_amount > 0 && pay_amount > bill_amount` (P-10) →
  `"Se paga $X y se cobra $Y"`.

### 5.6 Hook de wiring (`src/hooks/usePayrollAudit.ts`)

```ts
export interface AuditoriaPeriodo {
  conciliacion: ConciliacionResultado;
  vencidos: Shift[];
  doblePagos: DoblePago[];
  observacionesPorRun: Map<string, Observacion[]>;  // runId → observaciones
}
export function usePayrollAudit(periodStart: string, periodEnd: string): AuditoriaPeriodo;
// Lee shifts/payrollRuns/patients/shiftTypeDefs vía useLocalStorage; memoiza por [inputs, período].
```

---

## 6. Orden de implementación por entregas

Respeta el orden de `STORIES.md`. Cada entrega se sube y se prueba en producción antes de la
siguiente (Vercel build on push).

| Entrega | Historias | Depende de | Paralelizable |
|---------|-----------|-----------|---------------|
| **0 (base transversal)** | `Toast` (`components/ui/Toast.tsx` + provider en App), esqueleto de `payrollAudit.ts` con firmas + constantes | — | Toast y firmas de utils pueden ir en paralelo |
| **1** | **H1** (anular libera turnos), **H2** (feedback aprobar/pagar/anular), **H3** (feedback estado agenda) | Toast (E0) | H1 vs {H2,H3} en paralelo (H1 no toca UI de feedback). H2 y H3 comparten el Toast. **Luego: P-12 manual.** |
| **2** | **H4** (conciliación), **H5** (INCOMPLETO), **H6** (vencidos), **H8** (doble pago) | `conciliarPeriodo`, `turnosVencidos`, `detectarDoblePago` (E0); H4/H5 dependen de H1 | H6 y H8 en paralelo con H4/H5. H5 usa el `pendientes` de H4 (secuencial H4→H5). |
| **3** | **H9** (detalle con paciente/tarifa/observaciones), **H10** (resumen por paciente) | H2 (selectedPayroll derivado) | H9→H10 (H10 reusa el resolver de paciente de H9) |
| **4** | **H11** (lista de pendientes), **H12** (retroactivo) | H4 (misma fuente); H12 amplía `availablePeriods` | H11 y H12 en paralelo |
| **5** | **H16** (tarifa catálogo + $0), **H13** (rango histórico), **H14/H15** (topes 24h), **H18** (enfermera 24h/traslape), **H19** (pago>cobro), **H17** (confirmación al aprobar), **H20** (ajustes por período) | `validarTurno`/`validarPlanilla` (E0); H17 consume todas | **H16 primero** (cambia el cálculo base; probar que no altera montos correctos). Luego H13/H14/H15/H18/H19 en paralelo (cada control es independiente en `payrollAudit.ts`). **H17 al final** (agrega todas). H20 independiente, en paralelo. |

**BACKLOG (B1–B6)** queda fuera de esta iteración (así lo marca el plan).

---

## 7. Riesgos e invariantes — qué NO tocar

**Invariante central (no romper nunca):**
`shift.payroll_run_id  ↔  run.items[].shift_id  ↔  shift.payroll_included`.
Los tres deben moverse juntos. H1 los libera en bloque (patrón `handleDelete`, ya probado); ninguna
otra historia los muta.

**Prohibido tocar:**
- `src/hooks/useDB.ts` — motor de sync optimista + realtime (ya tuvo bug de datos pisados, commit
  `9da6367`). No se modifica su lógica de diffing/generaciones.
- **Correlativos** (`document_correlatives`, `system_correlatives`) y `Documents.tsx`/`services/db.ts`
  legacy — fuera de alcance.
- **Montos ya `approved`/`paid`**: no se recalculan sin confirmación explícita. H16 cambia el
  *fallback* de cálculo, pero para turnos con `pay_amount > 0` el resultado es idéntico
  (`if (s.pay_amount > 0) return s.pay_amount` se conserva) ⇒ no altera planillas correctas.

**Riesgos y mitigación:**
| Riesgo | Mitigación |
|--------|-----------|
| Falsas alarmas OBSERVADO llenan la pantalla (admin no técnico) | Calibración P-1 (historial mínimo ≥3), tolerancias `TOL_MONTO`/`TOL_TARIFA`, todo en constantes ajustables. OBSERVADO nunca bloquea. |
| H16 cambia montos ya correctos | Se conserva `pay_amount>0 ⇒ devuelve pay_amount`; solo cambia el fallback (turnos $0). Probar contra datos reales antes de deploy. |
| H20 cambia el neto de una enfermera al filtrar ajustes por período | Ajustes sin fecha → apartado manual (P-7), nunca silencioso. Revisar en resumen previo antes de aprobar. |
| Escritura en bulk `setShifts` (H1) pisa filas reales | Replica exactamente `handleDelete` (map puntual sobre ids afectados), no reescribe el array completo; `useDB` hace diff por id. |
| `availablePeriods` ampliado (H12) recorre muchos turnos en el teléfono | Conciliación es O(turnos del período); la lista de períodos deriva de fechas ya en memoria. Sin llamadas de red extra. |
| Doble compute de tarifa entre Calendar y auditoría diverge | `resolverTarifaEsperada` es la única fuente; Calendar debería importarla (o mantener idéntica la cadena). |

---

## GATE 2: LISTO

**3 decisiones clave tomadas:**

1. **Integración, no vista nueva.** Todo el feature vive dentro de `Payroll.tsx` y `Calendar.tsx`
   (regla de oro: revisar sin salir de Planillas), con la **lógica pura extraída a
   `src/utils/payrollAudit.ts`** (testeable, sin UI) y un hook fino `usePayrollAudit.ts` para wiring/
   memoización. Cero tablas nuevas: OBSERVADO se **calcula en vivo** derivando de `shifts`+`payrollRuns`;
   cero campos nuevos obligatorios; compatibilidad hacia atrás total (tolerar `undefined`).

2. **OBSERVADO nunca bloquea, con calibración anti-falsas-alarmas.** Se adoptan las 12
   recomendaciones del analista, reforzando P-1 (historial mínimo ≥3, si no tolerancia ±10% contra
   tarifa configurada) y P-8 (margen $1). Todos los umbrales son constantes con nombre en un solo
   archivo. Confirmación extra (`window.confirm`) solo en los dos puntos que mueven dinero: forzar
   reproceso (H8) y aprobar con observaciones (H17).

3. **Toast propio mínimo, cero dependencias npm.** `components/ui/Toast.tsx` + `ToastProvider` en
   `App.tsx`, con variables CSS existentes (modo oscuro automático) para éxitos no bloqueantes
   (H2/H3/H7); `window.confirm` se conserva solo para lo interruptor. `tsc -b && vite build` sigue
   pasando; UI en español; patrón responsive tabla-desktop/tarjeta-móvil ya existente.
