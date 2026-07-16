# REVIEW-REPORT — GATE REVISIÓN feature/auditoria-planillas

**Revisor:** Revisor de Código senior (solo lectura)
**Fecha:** 2026-07-15
**Rama:** `feature/auditoria-planillas` → `main`
**Alcance:** `git diff main...HEAD` (merge-base `e0d1ada`). 11 archivos de código + 6 `.md`.

## VEREDICTO: APROBADO CON OBSERVACIONES

No hay hallazgos **bloqueantes**: nada en el diff altera un monto ya correcto, rompe la
invariante de planillas en operación normal, pierde datos ni rompe un flujo existente.
Se listan 4 observaciones (2 media, 2 baja) y 1 informativa (pre-existente). Ninguna
detiene el merge; la #1 conviene atenderla antes de operar el reproceso de julio.

---

## Verificaciones mecánicas (evidencia, no opinión)

| Comando | Resultado |
|---|---|
| `npx tsc -b` | EXIT 0 — limpio |
| `npx vitest run` | **71/71 tests pasan** (1 archivo) |
| `npx eslint .` | **232 errores / 8 warnings** — idéntico a la línea base del QA (cero nuevos) |
| `npm audit` | 13 vulnerabilidades (8 high) — **todas en deps pre-existentes** (ver E) |

Los dos errores de lint visibles (`Payroll.tsx:719` `setEditingId` sin usar, `:1162`
`any`) son pre-existentes: el total coincide exacto con la línea base.

---

## Confirmaciones de los puntos críticos del encargo

**1. `handleVoid` libera turnos (Payroll.tsx:554-563).** En operación normal mantiene la
invariante `shift.payroll_run_id ↔ run.items[].shift_id ↔ shift.payroll_included`: libera
solo los ítems no-`ADJ` del run anulado, con el mismo patrón `map` puntual de `handleDelete`
(escritura por id, no reescribe el array — `useDB` hace diff por id). Los dos `activeRunIds`
del wizard (`:2659`, `:2688`) excluyen `status==='void'`, así que un turno cuyo run quedó
anulado se detecta como huérfano y se libera sin duplicar. **Salvedad: ver hallazgo #1** para
el borde de doble-planilla.

**2. `calculateRate` sin fallbacks 50/60/110 (Payroll.tsx:591-595 y :2727-2731).** Verificado
en **ambos** sitios (`handleRecalculate` y `NewPayrollWizard.handleProcess`): la primera línea
es `if (s.pay_amount && s.pay_amount > 0) return s.pay_amount;` ⇒ **toda planilla con monto
correcto conserva su monto exacto**. Sin `pay_amount`, resuelve `resolverTarifaEsperada`
(paciente → catálogo → `none`); si no hay referencia devuelve **0**, y `validarPlanilla`
lo marca `SIN_TARIFA` (OBSERVADO). Nunca inventa un número ni paga $0 en silencio. Correcto.

**3. Seguridad.** Sin secretos en el diff (los matches de "key/secret/password" están en
archivos de auth pre-existentes que este feature NO toca). Toasts renderizan `{t.message}`
como nodo de texto y `window.confirm`/`alert` reciben strings planos ⇒ **sin XSS/inyección
posible**. `App.tsx` solo envuelve el árbol con `ToastProvider`; **cero cambios a
autenticación/RLS/rutas protegidas**. Sin dependencias npm de producción nuevas (solo
`vitest` dev).

**4. Fechas.** Comparaciones consistentes: `conciliarPeriodo` usa `parseISO` + intervalo local
extendido a `23:59:59` del día fin; `ajustesDelPeriodo` compara strings `yyyy-MM-dd`
(lexicográficamente correcto) y match exacto de `period_start/end`. Bordes de quincena y
medianoche cubiertos por tests. Nunca `new Date(str)` para parsear.

**5. Compatibilidad hacia atrás.** Datos históricos sin campos nuevos toleran `undefined`
(`pay_amount ?? 0`, `bill_amount ?? 0`, `payroll_included`, `duration_hours ?? 0`). OBSERVADO
se calcula en vivo, no se persiste ⇒ sin migración. Verificado.

**6. Flujos existentes intactos.** `handleGeneratePayrollBatch`, `handleApprove` (solo agrega
confirmación H17), `handleRegisterPayment`, generación de recibos PDF (single/bulk ZIP) y
`handleExportReportes` (CSV) no cambian su lógica de negocio. `handleApprove` sigue escribiendo
por id.

**7. Correcciones post-QA (H3/H6) presentes.** H3: "Confirmar" (`Calendar.tsx:845-852`) y
"Marcar Realizado" (`:872-889`) ahora hacen `setSelectedShift({...})` en vivo sin cerrar el
panel. H6: el modal de vencidos tiene acciones directas Realizado/Cancelar
(`Payroll.tsx:2322-2333`, `:2363-2364`) vía `resolverVincido`. Ambos hallazgos del QA quedaron
resueltos.

---

## Hallazgos

### #1 — [MEDIA] `handleVoid` puede desincronizar un turno que pertenece a OTRA planilla vigente
**Archivo:** `src/views/Payroll.tsx:558-559` (idéntico latente en `handleDelete:567-568`).

**Escenario concreto de fallo:** existe un doble-pago pre-existente — el turno `T` está en los
`items` de la planilla `A` **y** de la `B`, ambas no-`void`, y `T.payroll_run_id` apunta a `B`.
El admin, para corregir, anula `A`. `handleVoid` recorre `run.items` de `A` y ejecuta
`{ ...s, payroll_included:false, payroll_run_id:undefined }` para `T` — **aunque `T` sigue en
`B.items` y `B` está vigente**. Resultado: `T.payroll_included=false` mientras `B` lo paga →
invariante rota, `conciliarPeriodo` lo reporta como *pendiente* y el banner H4 invita a
"Procesar ahora", que crearía una tercera planilla `C` → se vuelve a duplicar justo en el flujo
de remediación. `detectarDoblePago` deja de marcarlo tras anular `A` (queda en 1 run), ocultando
el problema.

No es bloqueante porque requiere un estado anómalo de doble-pago pre-existente (que el propio
feature está diseñado para evitar) y no altera los montos de `B`; pero es el punto exacto que el
encargo pidió blindar ("que no pueda liberar turnos de OTRA planilla vigente").

**Corrección sugerida:** liberar solo turnos que pertenecen a este run o están sueltos:
```ts
setShifts(prev => prev.map(s =>
  (shiftIds.includes(s.id) && (s.payroll_run_id === run.id || !s.payroll_run_id))
    ? { ...s, payroll_included: false, payroll_run_id: undefined }
    : s
));
```
Aplicar el mismo guardado en `handleDelete`.

### #2 — [MEDIA] `observacionesPorRun` recalcula validación pesada en cada tecla del buscador
**Archivo:** `src/views/Payroll.tsx:351-357`; costo en `payrollAudit.ts` `validarPlanilla`
(`:463-486`), `validarTurno` (`:282-389`), `validarEnfermerasDia` (`:399-454`).

**Escenario:** con `showHistorico=true` o al teclear en `planillasSearch`, `filteredRuns` cambia
y el `useMemo` recorre cada run llamando `validarPlanilla`. Cada llamada hace `shifts.find` por
ítem (O(items×N)), y `validarTurno` filtra `sameContextShifts` (todos los turnos) por ítem para
H15, más `validarEnfermerasDia` que filtra el universo por enfermera. Coste ≈
O(runs × items × N_turnos). Con miles de turnos e histórico visible, cada pulsación puede
producir *lag* perceptible en el teléfono. En uso normal (un período ⇒ pocos runs) el impacto es
bajo, por eso es media y no alta.

**Corrección sugerida:** construir una vez `Map<shiftId, Shift>` e índices por día
(`patient_id|día`) y por `nurse_id`, y pasarlos por `ContextoValidacion` en lugar de re-filtrar
`sameContextShifts` dentro de cada `validarTurno`. Alternativa barata: `debounce` del buscador o
calcular observaciones solo para la fila expandida/seleccionada.

### #3 — [BAJA] `gross_amount` se guarda sin pasar por `toMoney`
**Archivo:** `src/views/Payroll.tsx:2732` y `:597`.

`const gross = nurseShifts.reduce((a,b)=>a+calculateRate(b),0)` acumula sin redondear y se
persiste tal cual en `gross_amount`. El `net_amount` sí pasa por `toMoney(gross + ajustes)`, así
que **el pago final es correcto**; el riesgo es solo ruido de coma flotante en `gross_amount` y
en los KPIs que lo suman (queda enmascarado por `.toFixed(2)` al mostrar). Sugerencia:
`const gross = toMoney(nurseShifts.reduce(...))`.

### #4 — [BAJA] `resolverTarifaEsperada` corta en 'patient' aun con tarifa vacía
**Archivo:** `src/utils/payrollAudit.ts:242-245`.

`if (patientTariff) { return { pay: toMoney(patientTariff.cost), ... source:'patient' } }` — si el
paciente tiene una entrada `shift_tariffs[tipo]` presente pero con `cost` 0/`undefined`, devuelve
`pay:0 source:'patient'` y **no cae al catálogo**. Es seguro (nunca inventa monto; un turno $0 se
marca OBSERVADO), pero diverge de la intención "paciente → catálogo" cuando la tarifa del paciente
existe-pero-vacía. Sugerencia: condicionar a que `patientTariff.cost` sea un número > 0 antes de
cortar la cadena.

### E — [INFORMATIVO — pre-existente] Vulnerabilidades de dependencias
`npm audit`: 13 vulnerabilidades (8 high). Las relevantes están en **deps pre-existentes**, no
introducidas por este feature (que solo añadió `vitest` como devDependency): `xlsx` (Prototype
Pollution / ReDoS, **sin fix disponible**) usado por la exportación a Excel de datos internos de
planilla (entrada de confianza), y `ws` (transitiva). Riesgo bajo en una app interna sin entrada
de terceros, pero conviene planificar el reemplazo/actualización de `xlsx` fuera de este PR.

---

## GATE REVISIÓN: APROBADO

Conteo de hallazgos: **Bloqueante 0 · Alta 0 · Media 2 (#1, #2) · Baja 2 (#3, #4) ·
Informativo 1 (E, pre-existente)**.

Recomendación operativa: aplicar el guardado del hallazgo #1 en `handleVoid`/`handleDelete`
antes de ejecutar el reproceso manual de julio 2026 (P-12), por ser el flujo donde el borde de
doble-planilla podría manifestarse.
