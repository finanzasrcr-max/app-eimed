# QA-REPORT.md — Auditoría y Control de Planillas (H1–H20)

**Rama:** `feature/auditoria-planillas`
**Fecha de la revisión:** 2026-07-15
**QA:** revisión estática + pruebas unitarias automatizadas (sin navegador — ver sección 6).

## 0. Resumen ejecutivo

## GATE QA: APROBADO (con 2 hallazgos menores devueltos a frontend, ninguno bloqueante)

- **Dinero:** las 71 pruebas unitarias sobre `src/utils/payrollAudit.ts` (el núcleo que decide montos, conciliación, doble pago y observaciones OBSERVADO) **pasan**. Ningún test de dinero falla.
- **Regresión estática:** `npm run build` pasa, `npx tsc -b` limpio, `npm run lint` sigue en **exactamente 232 errores / 8 warnings** (cero nuevos) — línea base respetada.
- **Historias críticas (H1, H2, H8, H13–H17):** las 6 CUMPLEN contra el código, con evidencia archivo:línea. Ninguna crítica está NO CUMPLE ni PARCIAL.
- **Hallazgos:** 2 historias no críticas quedan PARCIAL (H3, H6) — defectos de interacción reales, reproducibles, pero ninguno bloquea el pago ni mueve dinero incorrectamente. Se documentan con reproducción exacta en la sección 4 y se devuelven a **frontend**.
- No se tocó ningún archivo de producción: el único cambio de código es el archivo de pruebas nuevo `src/utils/payrollAudit.test.ts` y la infraestructura de test (`package.json` + `vitest` como devDependency).

---

## 1. Resultados reales de los comandos (salida pegada, no resumida)

### 1.1 `npx vitest run` (71 pruebas nuevas, `src/utils/payrollAudit.test.ts`)

```
 RUN  v4.1.10 G:/Aplicaciones/App Eimed


 Test Files  1 passed (1)
      Tests  71 passed (71)
   Start at  23:03:36
   Duration  1.82s (transform 99ms, setup 0ms, import 1.52s, tests 28ms, environment 0ms)
```

Nota de proceso: en la primera corrida hubo **1 fallo** (`H18: enfermera con turnos que suman >24h...`). Investigado: era un bug en el dato sintético del test (la suma de horas de mis dos turnos daba 22.98h, no >24h), **no un bug del código fuente**. Se corrigió el test (turnos que cruzan medianoche, ver `payrollAudit.test.ts`) y volvió a pasar. No se tocó `payrollAudit.ts`. Se documenta aquí para que quede constancia de que las pruebas se ejecutaron de verdad y no se "arreglaron a la fuerza" para pasar.

### 1.2 `npm run build`

```
✓ built in 1.13s
```
(build completo, `tsc -b && vite build`, sin errores; incluye chunk `payrollAudit-BqQRpFNf.js` de 6.46 kB / 2.67 kB gzip — confirma que el módulo se separa correctamente en el bundle).

### 1.3 `npx tsc -b`

Salida vacía, `EXIT:0` — limpio, sin errores de tipos.

### 1.4 `npm run lint`

Baseline (antes de cualquier cambio, confirmado primero): **232 errores / 8 warnings**.

Después de agregar el test file: subió a 233 (un `Unexpected any` en `payrollAudit.test.ts:509`, por un `delete (s as any).bill_amount` usado para simular un turno histórico sin el campo). Se corrigió usando `bill_amount: undefined as unknown as number` en vez de `any` + `delete`. Resultado final:

```
✖ 240 problems (232 errors, 8 warnings)
```

**232 errores / 8 warnings — idéntico a la línea base. Cero errores nuevos.**

---

## 2. Qué se instaló / qué se tocó

- `npm i -D vitest` (única dependencia nueva, como se pidió explícitamente).
- `package.json`: se agregó `"test": "vitest run"`.
- Archivo nuevo: `src/utils/payrollAudit.test.ts` (71 tests, cubre las 12 funciones exportadas de `payrollAudit.ts`).
- **Ningún archivo de producción (`Payroll.tsx`, `Calendar.tsx`, `payrollAudit.ts`, `Toast.tsx`) fue modificado.** Esta revisión es de solo lectura sobre el código de producción; el único hallazgo de "bug inequívoco y menor" habría sido corregible por mandato del encargo, pero **no se encontró ningún bug así en `payrollAudit.ts`** — las 71 pruebas pasaron contra el código tal cual está.

---

## 3. Cobertura de pruebas unitarias (`payrollAudit.test.ts`)

Las 71 pruebas cubren **cada función exportada** de `payrollAudit.ts` con datos sintéticos mínimos tipados (fábricas `makeShift`, `makeRun`, `makePatient`, `makeShiftTypeDefs`, `makeAdj`):

| Función | Casos cubiertos |
|---|---|
| `conciliarPeriodo` | pendientes, sin pendientes, runs `void` excluidos (cuentan como pendiente), fuera de rango de fechas, `cancelled`/`replaced` excluidos, **borde exacto de quincena** (23:30 del día 15 entra, 00:00 del día 16 no entra en el mismo período pero sí en el siguiente, 00:00:00 del día 1 entra), tolerancia a `undefined` |
| `turnosVencidos` | los 4 estados pendientes (`scheduled/confirmed/replaced/incident`) aparecen; `completed`/`cancelled` no aparecen; futuros no aparecen; horizonte de 12 meses respetado y ampliable |
| `detectarDoblePago` | turno en 2 planillas vigentes detectado; turno en planilla `void` no cuenta; ítems `ADJ` no cuentan; sin duplicados no hay alerta |
| `resolverTarifaEsperada` | paciente → catálogo → `none`, en ese orden de prioridad (P-4) |
| `turnosPagados` | solo runs `paid`; excluye `ADJ` |
| `rangoHistorico` | ≥3 pagados → min/max; <3 → `null`; ignora montos $0; no mezcla pacientes/tipos |
| `superaCon` | borde exacto de `TOL_MONTO` ($1): igual al margen no dispara, un centavo más sí |
| `validarTurno` | H16 ($0 → `SIN_TARIFA`), H13 (fuera de rango con historial, dentro del rango con tolerancia $1, sin historial suficiente → ±10% contra tarifa configurada — P-1, sin ninguna referencia → `SIN_TARIFA_REFERENCIA` — P-4, **H16 tiene prioridad sobre H13** cuando el monto es $0), H14 (proyección ×24 > H24, dentro del H24 no marca, total real > H24 también marca aunque la proyección no), H15 (suma del día del paciente > H24, un solo turno no aplica, `cancelled`/`replaced` no suman), H19 (pago > cobro marca, pago ≤ cobro no marca, **`bill_amount` = 0 o ausente exime — P-10**) |
| `validarPlanilla` | agrega observaciones por turno, ignora `ADJ`, **deduplica** una observación de grupo repetida por cada turno del grupo (H15), H18 enfermera >24h (agrupado por día de inicio, cruzando medianoche, P-9) con severidad `critico`, H18 traslape con severidad `critico`, sin traslape y ≤24h no marca, `cancelled`/`replaced` no cuentan para el 24h/traslape |
| `resumenPorPaciente` | agrupación con conteo/total ordenado descendente, un solo paciente, `ADJ` excluido, turno eliminado → "Turno eliminado", paciente no encontrado → "Paciente no encontrado" |
| `ajustesDelPeriodo` | período exacto → `enPeriodo`; período de OTRO rango → no aparece en ningún lado (ni `enPeriodo` ni `sinPeriodo`, documentado a propósito); `date` dentro del rango → `enPeriodo`; `date` fuera → no aparece; **sin fecha asignable → `sinPeriodo` (P-7, nunca se aplica en silencio)**; ya `applied_payroll_id` → excluido (ya no pendiente) |

**Resultado:** ningún test razonable falló contra el código fuente. La lógica de dinero (`payrollAudit.ts`) se comporta como especifica `ARCHITECTURE.md §5` en todos los casos probados, incluyendo los bordes explícitamente señalados como riesgo en `STORIES.md` (P-1, P-8, P-9, P-10).

---

## 4. Hallazgos (por severidad) — devueltos a **frontend**

### 4.1 [MEDIO] H3 — "Confirmar" y "Marcar Realizado" cierran el panel de turno en vez de actualizarlo en vivo

**Historia:** H3 — Retroalimentación al cambiar el estado de un turno en la agenda.
**Archivo:** `src/views/Calendar.tsx:844-855` (Confirmar) y `:883-900` (Marcar Realizado).

**Criterio de aceptación violado:** *"Dado un turno abierto en la agenda, Cuando cambio su estado (confirmar, realizado, cancelar, reemplazar), Entonces la etiqueta de estado del panel se actualiza en vivo **sin cerrar el panel**."*

**Reproducción:**
1. Abrir un turno `scheduled` en el panel de la agenda.
2. Pulsar "Confirmar" → `setShifts(...)` actualiza el turno, se dispara `toast.success('Turno confirmado ✓')`, pero la línea siguiente ejecuta `setSelectedShift(null)` — el panel se cierra en vez de mostrar la etiqueta "Confirmado" en vivo.
3. Lo mismo ocurre con "MARCAR COMO REALIZADO" (`Calendar.tsx:897`, `setSelectedShift(null)` tras el toast/aviso H7).

Contraste: "Cancelar" (`:859-868`) y "Reemplazar" (`:869-878`) sí hacen `setSelectedShift({...selectedShift, status: '...'})` (actualización en vivo, panel abierto) — el patrón correcto ya existe en el mismo archivo, solo falta aplicarlo a Confirmar y a Marcar Realizado.

**Impacto:** bajo para el dinero (no toca montos ni pagos), medio para la confianza del usuario no técnico — es exactamente el síntoma que H3 fue creada para resolver ("no cerrar el panel para confiar en que quedó guardado"), y 2 de las 4 acciones todavía lo hacen.

**Caso borde también pendiente:** el criterio de aceptación pide que si el guardado falla, "la etiqueta no cambia y no aparece el aviso de éxito". Hoy no hay ningún `try/catch` alrededor de `setShifts`/`toast.success` en ninguna de las 4 acciones (el único `try` presente, `:888-896`, cubre solo el parseo de fecha para el aviso H7, no el guardado en sí). Con el patrón optimista de `useLocalStorage` esto es aceptable como diseño (documentado en `ARCHITECTURE.md §3`, "hoy basta el patrón optimista"), pero formalmente el caso borde no está implementado ni es verificable sin un fallo real de storage.

**Sugerencia de fix (no aplicada — corresponde a frontend):** replicar en Confirmar y Marcar Realizado el mismo patrón que ya usan Cancelar/Reemplazar (`setSelectedShift({...selectedShift, status: 'X'})` en vez de `setSelectedShift(null)`), o si el cierre del panel es intencional para estas dos acciones específicas, aclarar la decisión en `ARCHITECTURE.md` porque hoy contradice el criterio de aceptación literal de H3.

---

### 4.2 [MEDIO] H6 — La lista de turnos vencidos no permite marcar Realizado/Cancelado ni navega al turno específico

**Historia:** H6 — Turnos vencidos sin resolver.
**Archivo:** `src/views/Payroll.tsx:2311-2318` (fila desktop) y `:2340` (tarjeta móvil), modal `showVencidosModal` (`:2291-2351`).

**Criterio de aceptación violado:** *"Dado esa lista, Cuando abro un turno vencido, Entonces puedo marcarlo Realizado o Cancelado (o navegar al turno en la agenda)."*

**Reproducción:**
1. Tener un turno `scheduled` con fecha pasada (aparece en `vencidos` vía `turnosVencidos`, confirmado que el cálculo es correcto y en vivo — `Payroll.tsx:275`).
2. Abrir el modal "Turnos vencidos sin resolver" (banner → "Ver lista").
3. La única acción disponible por fila es el botón "Ver en agenda", que ejecuta `navigate('/calendar')` **sin ningún identificador del turno ni de la fecha** — abre la agenda en su estado por defecto, obligando al administrador a buscar manualmente el turno entre todos los turnos del calendario.
4. No existe ningún botón "Marcar Realizado" ni "Cancelar" directamente en la lista.

**Impacto:** bajo para el dinero (es una lista de solo lectura + navegación, no muta nada por sí sola), medio para la usabilidad del admin no técnico que opera desde el teléfono — la historia existe justamente para que estos turnos "se resuelvan uno a uno" sin fricción, y hoy el paso de resolución requiere buscar el turno manualmente en la agenda.

**Nota:** la lista sí se actualiza en vivo cuando se resuelve un turno desde la agenda (deriva de `useMemo` sobre `shifts`, no una copia estática) — esa parte del criterio ("desaparece de la lista y el contador baja") sí se cumple.

**Sugerencia de fix (no aplicada — corresponde a frontend):** o bien agregar acciones directas "Marcar Realizado"/"Cancelar" en cada fila del modal (reutilizando la lógica ya existente en Calendar), o pasar el `shift.id`/fecha como parámetro de navegación (`navigate('/calendar?shiftId=...')`) y que `Calendar.tsx` abra el panel de ese turno automáticamente al montar.

---

### 4.3 [INFORMATIVO — no requiere acción] H9, wording de paciente no encontrado

`Payroll.tsx` usa `getPatientName()` que devuelve `'Paciente Desconocido'` cuando el paciente no existe, en vez del texto literal `"Paciente no encontrado"` sugerido por el criterio de aceptación de H9. El criterio acepta explícitamente `"---"` **o** un texto equivalente ("sin romper la vista"); `getPatientName` es el helper ya usado en el resto de la vista para mantener consistencia de idioma/tono, y no rompe nada. No se devuelve como hallazgo, se deja anotado por transparencia.

---

## 5. Tabla historia por historia (H1–H20)

| # | Historia | Veredicto | Evidencia |
|---|---|---|---|
| H1 | Anular libera turnos | **CUMPLE** | `Payroll.tsx:554-563` (`handleVoid` limpia `payroll_included`/`payroll_run_id` de ítems no-`ADJ`, igual que `handleDelete` `:565-572`); `activeRunIds` excluye `void` en el wizard (`:2634`, `:2663`) |
| H2 | Feedback aprobar/pagar/anular | **CUMPLE** | `selectedPayroll` derivado por id en cada render (`:148`, con `useEffect` de auto-cierre si la planilla ya no existe `:149-153`); toasts en `handleApprove` (`:523`), `handleRegisterPayment` (`:548`), `handleVoid` (`:561`) |
| H3 | Feedback estado de turno en agenda | **PARCIAL** | Ver hallazgo 4.1 — Cancelar/Reemplazar/Desmarcar cumplen; Confirmar y Marcar Realizado cierran el panel en vez de actualizar en vivo |
| H4 | Banner de conciliación | **CUMPLE** | `Payroll.tsx:853-867`, banner rojo condicionado a `conciliacion.pendientes.length>0`, botones "Ver turnos"/"Procesar ahora" (pasa `defaultPeriodStart/End` al wizard `:2201-2202`); lógica en `payrollAudit.ts:58-86` |
| H5 | Estado INCOMPLETO | **CUMPLE** | `getPeriodStatus` (`Payroll.tsx:299-308`) da prioridad a `pendientes>0 → incompleto` incluso con `runs.length===0` (P-2); meta `incompleto` en `PERIOD_STATUS_META` (`:313`) |
| H6 | Turnos vencidos | **PARCIAL** | Ver hallazgo 4.2 — lista correcta y en vivo, pero sin acción directa Realizado/Cancelado ni navegación al turno específico |
| H7 | Aviso al marcar Realizado en período pagado | **CUMPLE** | `Calendar.tsx:888-896`: compara `shiftDay` contra `payrollRuns` con `status==='paid'`, `toast.warning(...)`; nunca bloquea el marcado (el `status:'completed'` ya se aplicó antes del chequeo) |
| H8 | Doble pago + confirmación de forzar | **CUMPLE** | Alerta crítica visible en pantalla principal (`Payroll.tsx:869-882`), modal de detalle (`:2354-2410`); `detectarDoblePago` excluye `ADJ` y `void` (`payrollAudit.ts:120-138`, probado); `window.confirm` explícito antes de activar `forceReprocess` (`Payroll.tsx:2821-2829`) |
| H9 | Detalle con paciente/tipo/tarifa/observaciones | **CUMPLE** | `Payroll.tsx:1890-1992`: fecha, paciente (`getPatientName`), tipo, tarifa, marca OBSERVADO cruzando `selectedPayrollObservaciones`; `ADJ` sin paciente; turno inexistente no rompe (ver nota 4.3) |
| H10 | Resumen por paciente | **CUMPLE** | `Payroll.tsx:1999-2018`, usa `resumenPorPaciente` (probado); un solo paciente sí se muestra; `ADJ` excluido y mostrado aparte |
| H11 | Lista de pendientes | **CUMPLE** | Modal `showPendientesModal` (`:2214-2288`), 5 datos por fila, "Procesar ahora", mensaje de lista vacía exacto (`:2217`) |
| H12 | Auditoría retroactiva | **CUMPLE** | `availablePeriods` (`Payroll.tsx:222-254`) incluye períodos con `completed` sin planilla (P-6); conciliación evaluada sobre `activePeriodKey` navegado, no cableada al actual |
| H13 | OBSERVADO rango histórico | **CUMPLE** | `validarTurno` (`payrollAudit.ts:290-325`), 6 tests unitarios pasando incl. bordes P-1/TOL_MONTO/TOL_TARIFA |
| H14 | OBSERVADO tarifa/hora ×24 | **CUMPLE** | `validarTurno` (`:327-346`), 3 tests unitarios pasando (proyección, total real, dentro de rango); aviso también en `Calendar.tsx` formulario (confirmado por subagente, `validarTurno` filtrado por código en el `ShiftForm`) |
| H15 | OBSERVADO suma del día paciente | **CUMPLE** | `validarTurno` (`:348-375`), 3 tests unitarios; deduplicación verificada en `validarPlanilla` |
| H16 | OBSERVADO sin tarifa + catálogo | **CUMPLE** | `SIN_TARIFA` con prioridad sobre H13 (probado); fallback vía catálogo en `handleRecalculate` (`Payroll.tsx:582-586`) y en el wizard (`:2702-2706`), **`pay_amount>0` siempre se respeta** (`if (s.pay_amount && s.pay_amount > 0) return s.pay_amount`) — verificado que los montos ya correctos no cambian |
| H17 | Confirmación extra al aprobar con OBSERVADO | **CUMPLE** | `handleApprove` (`Payroll.tsx:498-524`): `window.confirm` enumerando observaciones solo si `obs.length>0`; aprueba directo si no hay observaciones; distinción visual con chip `OBSERVADO`/`CRÍTICO` en la columna Alertas (`:998-1000`, `:1066-1068`) |
| H18 | OBSERVADO enfermera 24h/traslape | **CUMPLE** | `validarEnfermerasDia` (`payrollAudit.ts:399-454`), 4 tests unitarios incl. cruce de medianoche (P-9) y exclusión de `cancelled`/`replaced` |
| H19 | OBSERVADO pago > cobro | **CUMPLE** | `validarTurno` (`:377-386`), 4 tests unitarios incl. `bill_amount=0`/ausente exime (P-10) |
| H20 | Ajustes por período | **CUMPLE** | `ajustesDelPeriodo` (`:503-527`), 6 tests unitarios; usado en el wizard (`Payroll.tsx:2621-2624`, `:2708-2720`) con detalle visible antes de procesar (`:2788-2814`) |

**Resumen:** 18 CUMPLE, 2 PARCIAL (H3, H6), 0 NO CUMPLE. Ninguna de las historias críticas (H1, H2, H8, H13–H17) está PARCIAL o NO CUMPLE — el veredicto de aprobación se sostiene sobre esa base.

---

## 6. Qué NO se pudo verificar (limitaciones de esta revisión)

Esta revisión fue **estática + pruebas unitarias**, sin navegador (no hay Playwright/Vitest+jsdom con render de componentes configurado, y no se instaló infraestructura de e2e por estar fuera del alcance explícito del encargo). En consecuencia, **no se verificó visualmente**:

- Que los banners, modales y tarjetas móviles realmente se vean bien y sin desbordes en un viewport real de 360px / 1280px (se verificó por inspección de clases CSS — `.mobile-cards`/`.entity-card`, breakpoints `@media (max-width:768px)` y `(max-width:640px)` en `Payroll.css`/`Calendar.css`/`index.css` — pero no se renderizó en un navegador real ni se tomó captura).
- El comportamiento real de los toasts (apilado, auto-cierre a 3.5-5s, descartable al tocar) en un dispositivo táctil real.
- El flujo completo de "Procesar Período" con `forceReprocess` de punta a punta contra `localStorage` real del navegador (se verificó la lógica en aislamiento vía los tests de `payrollAudit.ts`, pero no el wizard React completo montado).
- Que `usePayrollAudit.ts` (mencionado en `ARCHITECTURE.md §2.1` como hook de wiring) exista o esté siendo usado — la implementación real que se revisó usa `useMemo` directamente dentro de `Payroll.tsx`, lo cual el propio `ARCHITECTURE.md §2.1` contempla como alternativa válida ("el hook es opcional... puede colapsarse en un useMemo dentro de Payroll.tsx"). No se considera desviación.
- Casos de concurrencia/multi-pestaña sobre `useDB`/`useLocalStorage` (fuera de alcance explícito: "Prohibido tocar `useDB.ts`", `ARCHITECTURE.md §7`).

**Recomendación:** antes de reprocesar julio 2026 en producción (P-12), hacer una pasada manual rápida en el teléfono real confirmando que el banner H4 y el modal de pendientes se ven correctamente, ya que es el flujo operativo inmediato que depende de este feature.

---

## GATE QA: APROBADO

**Hallazgos devueltos a frontend** (ninguno bloqueante para este gate, ambos de severidad media, no tocan dinero):
1. H3 — `Calendar.tsx:849` y `:897` — Confirmar y Marcar Realizado cierran el panel de turno en vez de actualizarlo en vivo (contradice el criterio de aceptación literal). Reproducción en sección 4.1.
2. H6 — `Payroll.tsx:2311-2318`, `:2340` — la lista de turnos vencidos no ofrece acción directa Realizado/Cancelado ni navega al turno específico, solo a `/calendar` en general. Reproducción en sección 4.2.
