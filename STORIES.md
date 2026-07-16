# STORIES — Auditoría y Control de Planillas

**Fuente:** `Cambios solicitados/PLAN-PLANILLAS-15072026.md`
**App:** EIMED CareOps (React 19 + Vite + Supabase) — EN PRODUCCIÓN. Vista principal afectada: `src/views/Payroll.tsx`. Agenda: `src/views/Calendar.tsx`. Tipos: `src/types/index.ts`.
**Usuario:** administrador NO técnico que opera desde el teléfono. **Toda historia debe verse y funcionar en móvil (<768px).**
**Regla de oro del plan:** ningún turno REALIZADO puede quedar sin pagar en silencio; los montos fuera de lo normal se marcan (no bloquean); la revisión se hace sin salir de Planillas.

## Contexto técnico verificado en el código (para las notas de cada historia)
- Estado del turno: `Shift.status` = `scheduled | confirmed | completed | cancelled | replaced | incident`. **"REALIZADO" = `completed`.** (`types/index.ts:168`, `:185`)
- Turno en planilla: `Shift.payroll_included` + `Shift.payroll_run_id`. (`types/index.ts:192-193`)
- Estados de planilla: `draft | calculated | approved | paid | void`. (`types/index.ts:242`)
- Tarifa del paciente por tipo de turno: `Patient.active_service.shift_tariffs[shift_type_id].cost` (pago) y `.charge` (cobro). (`types/index.ts:118-119`) — esta es la referencia H24 y de cobro pedida por Fase 3 y 6.8.
- Tarifas de respaldo fijas HOY en código: DÍA=50, NOCHE=60, H24=110, HORAS=0 en `calculateRate` (`Payroll.tsx:424-431`) — la Fase 3.3 pide reemplazarlas por el catálogo (`ShiftTypeDef.default_cost`, `types/index.ts:163`).
- `getPeriodStatus` hoy solo mira planillas existentes, no el calendario (`Payroll.tsx:186-194`).
- `activeRunIds` incluye planillas anuladas (`Payroll.tsx:2119`, `:2147`).
- El detalle de planilla muestra fecha + tipo de turno pero **NO el paciente** (`Payroll.tsx:1690-1732`).
- Columna "Alertas" ya existe en la tabla, hoy siempre vacía (`Payroll.tsx:747`).
- **No existe sistema de toasts** en la app; hoy se usan `window.alert` / `window.confirm` y badges inline (ver Preguntas Abiertas P-11).

---

# ENTREGA 1 — Fase 1: correcciones urgentes (bugs confirmados)

### H1 — Anular una planilla libera sus turnos
**Como** administrador **quiero** que al anular una planilla sus turnos vuelvan a quedar disponibles **para** poder re-procesarlos y que no queden bloqueados para siempre.

**Contexto:** hoy `handleVoid` (`Payroll.tsx:406`) solo marca la planilla como `void` pero NO limpia `payroll_included` / `payroll_run_id` de los turnos; además `activeRunIds` (`Payroll.tsx:2119`) cuenta las anuladas como vigentes. Resultado: turnos atrapados que nunca se vuelven a pagar.

**Criterios de aceptación**
- Dado un turno incluido en una planilla, Cuando anulo esa planilla, Entonces cada turno (excepto los ítems de tipo `ADJ`) queda con `payroll_included = false` y `payroll_run_id` vacío, igual que hace `handleDelete` (`Payroll.tsx:412-419`).
- Dado un turno liberado por una anulación, Cuando abro "Procesar Período" del rango correspondiente, Entonces el turno aparece como disponible para procesar.
- Dado el asistente de procesar, Cuando calcula qué turnos siguen atrapados, Entonces las planillas con `status === 'void'` se excluyen de `activeRunIds` (`Payroll.tsx:2119` y `:2147`), de modo que turnos atrapados por anulaciones VIEJAS se detecten como "huérfanos" y se liberen solos.
- Dado que confirmo la anulación, Entonces la planilla queda en estado `void` (no se elimina el registro).
- Caso borde: los ítems `ADJ` (ajustes/anticipos) no tienen `shift_id` real y NO deben tocar ningún turno.

**Móvil:** la acción se dispara desde el menú ⋮ y desde el detalle; ambos disponibles en tarjetas móviles.
**Notas técnicas:** modificar `handleVoid` (`Payroll.tsx:406`); filtrar `void` en los dos `activeRunIds` (`:2119`, `:2147`).
**Riesgo:** bajo (no toca montos ni pagos existentes).

---

### H2 — Retroalimentación al aprobar / pagar / anular una planilla
**Como** administrador **quiero** ver que la acción funcionó y que el estado cambie en vivo **para** no repetir clics ni dudar si se aprobó.

**Contexto:** el botón "Aprobar" del detalle (`Payroll.tsx:1802-1806`) actualiza la lista pero `selectedPayroll` es una copia vieja: la ventana sigue mostrando "Calculado" y el botón sigue visible ("el menú que no se oculta").

**Criterios de aceptación**
- Dado el detalle de una planilla en estado `calculated`, Cuando pulso "Aprobar", Entonces el badge de estado cambia en vivo a "APROBADO" y el botón "Aprobar" desaparece sin cerrar/reabrir el detalle.
- Implementación: `selectedPayroll` se deriva de la lista actual (buscar por `id` en `payrollRuns` al renderizar) en vez de guardar una copia (`Payroll.tsx:82`, `:1598`).
- Dado cualquier acción de estado (Aprobar, Registrar Pago, Anular) en el menú ⋮ o en el detalle, Cuando se completa, Entonces se muestra un aviso visual de confirmación ("Planilla aprobada ✓", "Pago registrado ✓", "Planilla anulada ✓").
- Caso borde: si la acción falla (error de guardado), NO se muestra el aviso de éxito y el estado no cambia.

**Móvil:** el aviso debe ser legible en pantalla pequeña (no depender de hover); el badge de estado visible en la tarjeta y en el detalle.
**Notas técnicas:** derivar `selectedPayroll` por id; añadir aviso en `handleApprove` (`:370`), `handleRegisterPayment` (`:385`), `handleVoid` (`:406`). Ver P-11 sobre el mecanismo de aviso.
**Riesgo:** bajo (solo interfaz).

---

### H3 — Retroalimentación al cambiar el estado de un turno en la agenda
**Como** administrador **quiero** que al Confirmar / Marcar Realizado / Cancelar / Reemplazar un turno la etiqueta de estado del panel cambie en vivo y me avise **para** confiar en que quedó guardado.

**Criterios de aceptación**
- Dado un turno abierto en la agenda, Cuando cambio su estado (confirmar, realizado, cancelar, reemplazar), Entonces la etiqueta de estado del panel se actualiza en vivo sin cerrar el panel.
- Dado ese cambio de estado, Entonces se muestra un aviso visual de confirmación.
- Caso borde: si el guardado falla, la etiqueta no cambia y no aparece el aviso de éxito.

**Móvil:** panel de turno y avisos legibles en teléfono.
**Notas técnicas:** `src/views/Calendar.tsx` (acciones de estado de turno). Mismo mecanismo de aviso que H2.
**Riesgo:** bajo (solo interfaz).

---

# ENTREGA 2 — Fase 2.1 + 2.2 + Fase 6 (1, 2, 6): conciliación, INCOMPLETO, vencidos, doble pago

### H4 — Alerta de conciliación calendario vs planillas en el período
**Como** administrador **quiero** que al abrir Planillas el sistema compare los turnos realizados contra los que están en planilla y me avise la diferencia **para** que ningún turno realizado quede sin pagar en silencio (raíz del problema de julio).

**Criterios de aceptación**
- Dado el período seleccionado, Cuando abro la pestaña Planillas, Entonces el sistema calcula:
  - `realizados` = turnos con `status = completed` cuya fecha cae dentro del período.
  - `enPlanilla` = turnos incluidos en planillas NO anuladas del período (`payroll_included` con `payroll_run_id` de una planilla no `void`).
  - `pendientes` = `realizados − enPlanilla`.
- Dado `pendientes > 0`, Entonces se muestra un banner rojo permanente: **"⚠ Hay X turnos realizados sin planilla en este período"** con botón "Ver turnos" (H11) y botón "Procesar ahora" que abre el asistente ya con las fechas del período.
- Dado `pendientes = 0`, Entonces no se muestra el banner rojo.
- Caso borde: un turno realizado incluido en una planilla ANULADA cuenta como pendiente (porque ya no está pagado).
- Caso borde: turnos `cancelled` NO cuentan como realizados ni como pendientes.

**Móvil:** banner de ancho completo, botones apilados y tocables; texto legible sin zoom.
**Notas técnicas:** nuevo cálculo derivado en `Payroll.tsx` sobre `shifts` filtrados por período; reutiliza la lógica de rango del asistente (`:2119` en adelante). Solo lectura de datos. Depende conceptualmente de H1 (planillas anuladas ya no cuentan como vigentes).
**Riesgo:** bajo.

---

### H5 — El estado del período refleja la realidad (INCOMPLETO)
**Como** administrador **quiero** que el período muestre "INCOMPLETO" cuando falten turnos por pagar **para** no dar por cerrado un período que en realidad tiene pagos pendientes.

**Contexto:** hoy `getPeriodStatus` (`Payroll.tsx:186`) solo mira las planillas: si todas están pagadas dice "cerrado" aunque falten 25 turnos.

**Criterios de aceptación**
- Dado `pendientes > 0` (de H4), Entonces el estado del período muestra **"INCOMPLETO"** (color naranja/advertencia) en lugar de "Cerrado".
- Dado `pendientes = 0` **y** todas las planillas del período en `paid`, Entonces el estado muestra "Cerrado".
- Dado un período ya "Cerrado", Cuando alguien marca un turno viejo como realizado dentro de ese rango, Entonces el período vuelve a "INCOMPLETO" automáticamente y reaparece la alerta de H4.
- Caso borde (ver P-2): un período con turnos realizados pero SIN ninguna planilla creada debe mostrar "INCOMPLETO" (hoy `getPeriodStatus` con 0 runs devuelve "borrador").

**Móvil:** el badge de estado visible en la cabecera del período y legible.
**Notas técnicas:** ampliar `getPeriodStatus` para recibir/consultar `pendientes`; añadir meta "INCOMPLETO" a `PERIOD_STATUS_META` (`:196`).
**Riesgo:** bajo.

---

### H6 — Turnos vencidos sin resolver (Fase 6.1)
**Como** administrador **quiero** ver los turnos con fecha ya pasada que siguen sin marcarse como Realizado o Cancelado **para** resolverlos antes de cerrar, porque hoy nunca entran a planilla y nadie los ve.

**Criterios de aceptación**
- Dado turnos con fecha anterior a hoy y `status` en `scheduled | confirmed | replaced | incident` (PROGRAMADO/CONFIRMADO/REEMPLAZADO/INCIDENCIA), Entonces se muestra una alerta permanente: **"X turnos con fecha vencida sin marcar como Realizado o Cancelado"** con una lista para resolverlos uno a uno.
- Dado esa lista, Cuando abro un turno vencido, Entonces puedo marcarlo Realizado o Cancelado (o navegar al turno en la agenda).
- Dado que resuelvo un turno de la lista, Entonces desaparece de la lista y el contador baja.
- Caso borde: turnos `completed` o `cancelled` NO aparecen. Turnos futuros NO aparecen.

**Móvil:** lista en formato tarjeta (patrón `.mobile-cards`/`.entity-card` ya usado en el repo), acciones tocables.
**Notas técnicas:** deriva de `shifts` por fecha+estado. Alcance de fechas: ver P-6 (¿solo período visible o todos?). Complementa H4 (H4 encuentra los realizados sin pagar; H6 los que ni llegaron a realizados).
**Riesgo:** bajo (solo lectura + acciones ya existentes).

---

### H7 — Aviso al marcar Realizado un turno de un período ya pagado (Fase 6.2)
**Como** administrador **quiero** un aviso inmediato cuando marco Realizado un turno cuyo período ya tiene planillas pagadas **para** enterarme en el momento y no en el cierre siguiente.

**Criterios de aceptación**
- Dado un turno cuya fecha cae en un período que ya tiene al menos una planilla `paid`, Cuando lo marco como Realizado, Entonces aparece de inmediato el aviso: **"Este turno quedó fuera de la planilla ya pagada; el período volverá a INCOMPLETO hasta que lo procese"**.
- Dado ese cambio, Entonces el período afectado pasa a INCOMPLETO (consistente con H5).
- Caso borde: si el período NO tiene planillas pagadas, se marca Realizado sin este aviso especial.

**Móvil:** aviso legible en teléfono desde la agenda.
**Notas técnicas:** en la acción "Marcar Realizado" (`Calendar.tsx`), comprobar si existe planilla `paid` cubriendo la fecha del turno.
**Riesgo:** bajo.

---

### H8 — Detector de doble pago + confirmación al forzar reprocesamiento (Fase 6.6)
**Como** administrador **quiero** que el sistema detecte si un mismo turno quedó en dos o más planillas vigentes y que "Forzar reprocesamiento" me advierta **para** no pagar dos veces el mismo turno.

**Criterios de aceptación**
- Dado un mismo `shift_id` presente en 2 o más planillas NO anuladas (`status != void`), Entonces se muestra una alerta crítica en rojo indicando el turno y las dos (o más) planillas involucradas.
- Dado el asistente de procesar, Cuando activo "Forzar reprocesamiento", Entonces primero aparece una confirmación explícita advirtiendo que puede duplicar pagos, y solo continúa si confirmo.
- Dado que no hay turnos duplicados, Entonces no se muestra ninguna alerta de doble pago.
- Caso borde: los ítems `ADJ` no se consideran (no tienen `shift_id` de turno real).

**Móvil:** alerta de doble pago visible en la pantalla principal de Planillas; confirmación de forzar en diálogo tocable.
**Notas técnicas:** auditoría derivada recorriendo `payrollRuns` no-void y agrupando por `shift_id`. La confirmación de "Forzar reprocesamiento" es sobre `forceReprocess` (`Payroll.tsx:2162`).
**Riesgo:** bajo (lectura + una confirmación).

---

# ENTREGA 3 — Fase 4: revisar el pago sin ir a la agenda

### H9 — Detalle de planilla con paciente, tipo, tarifa y observaciones
**Como** administrador **quiero** ver en el detalle de cada planilla, por cada turno, la fecha, el paciente, el tipo de turno, la tarifa y las observaciones **para** saber de un vistazo a qué pacientes corresponde cada turno cobrado, sin ir a la agenda.

**Contexto:** hoy el detalle muestra solo fecha + tipo de turno (`Payroll.tsx:1690-1732`); el recibo impreso sí muestra el paciente, la pantalla de revisión no.

**Criterios de aceptación**
- Dado el detalle de una planilla, Cuando lo abro, Entonces cada renglón de turno muestra: fecha, **nombre del paciente**, tipo de turno, tarifa/monto y, si aplica, la marca OBSERVADO y su motivo (integra con Entrega 5).
- Dado un ítem de tipo `ADJ` (ajuste), Entonces se muestra como ajuste/deducción sin paciente (comportamiento actual conservado).
- Caso borde: si el turno referido ya no existe o no tiene paciente asignado, mostrar "---" o "Paciente no encontrado" sin romper la vista.

**Móvil:** cada renglón debe caber en el ancho del teléfono sin desbordar; nombre del paciente no truncado de forma confusa.
**Notas técnicas:** en el `map` de `selectedPayroll.items` (`Payroll.tsx:1653-1732`), resolver `patient` desde `shift.patient_id` y mostrar su nombre (helper de nombre de paciente ya presente en la vista).
**Riesgo:** bajo.

---

### H10 — Resumen por paciente en el detalle de planilla
**Como** administrador **quiero** un renglón resumen por paciente dentro del detalle **para** detectar rápido un turno asignado al paciente equivocado.

**Criterios de aceptación**
- Dado el detalle de una planilla, Entonces se muestra un resumen tipo: "3 turnos con Cristina Perla ($150), 2 con Héctor Medrano ($220)…", agrupando por paciente con conteo y monto total.
- Dado una planilla con un solo paciente, Entonces igualmente se muestra el resumen (una sola línea).
- Caso borde: los ítems `ADJ` se excluyen del agrupado por paciente (o se muestran aparte como "Ajustes").

**Móvil:** resumen apilado verticalmente, legible.
**Notas técnicas:** agregación en memoria sobre `selectedPayroll.items` resolviendo paciente por turno.
**Riesgo:** bajo.

---

# ENTREGA 4 — Fase 2.3 + 2.4: lista de pendientes + retroactivo

### H11 — Lista de turnos pendientes (detalle de la diferencia)
**Como** administrador **quiero** ver la lista de turnos realizados sin planilla del período **para** decidir si los proceso o si estaban mal marcados.

**Criterios de aceptación**
- Dado el banner de H4, Cuando pulso "Ver turnos", Entonces se abre una lista con, por cada turno pendiente: fecha, enfermera, paciente, tipo de turno y monto.
- Dado esa lista, Cuando pulso "Procesar ahora", Entonces se abre el asistente con las fechas del período.
- Dado un turno mal marcado, Entonces desde la lista puedo navegar al turno para corregirlo (o al menos identificarlo para corregirlo en la agenda).
- Caso borde: si `pendientes = 0`, la lista aparece vacía con mensaje "No hay turnos pendientes en este período".

**Móvil:** lista en tarjetas (`.mobile-cards`), cada tarjeta con los 5 datos; botones tocables.
**Notas técnicas:** misma fuente de datos que H4 (`pendientes`). Reutiliza el helper de nombre de enfermera/paciente.
**Riesgo:** bajo.

---

### H12 — Auditoría retroactiva a períodos anteriores
**Como** administrador **quiero** que la conciliación aplique también a períodos anteriores (mayo, junio, etc.) **para** descubrir turnos que quedaron sin pagar hacia atrás.

**Criterios de aceptación**
- Dado que navego a un período anterior, Entonces se calcula la misma conciliación de H4 (`realizados`, `enPlanilla`, `pendientes`) y, si hay pendientes, se muestran el banner (H4) y el estado INCOMPLETO (H5).
- Dado un período viejo ya correcto (pendientes = 0), Entonces no aparece alerta.
- Caso borde de rendimiento: el cálculo debe seguir siendo fluido en el teléfono aunque haya muchos períodos (ver P-6 sobre alcance/límite de antigüedad).

**Móvil:** navegación entre períodos ya existente; alertas idénticas a H4/H5.
**Notas técnicas:** la conciliación de H4 no debe estar cableada al período actual; se evalúa para el período navegado. Solo lectura.
**Riesgo:** bajo.

---

# ENTREGA 5 — Fase 3 (validaciones OBSERVADO) + Fase 6 (7, 8, 10)

> **Regla transversal (del plan):** OBSERVADO **NO bloquea** el pago; marca el renglón y la planilla en la columna "Alertas" (`Payroll.tsx:747`) y pide **confirmación extra** al aprobar (ver H17). Ver P-3.

### H13 — OBSERVADO: pago fuera del rango histórico (Fase 3.1)
**Como** administrador **quiero** que se marque OBSERVADO cuando el pago de un turno se sale del rango que históricamente se ha pagado a ese paciente por ese tipo de turno **para** cazar montos anómalos antes de pagar.

**Criterios de aceptación**
- Dado que proceso una planilla, Entonces por cada turno se compara su monto contra el historial de turnos **ya pagados** del mismo paciente y mismo tipo de turno.
- Dado un monto mayor al máximo histórico o menor al mínimo histórico, Entonces el turno queda **OBSERVADO: "Pago fuera del rango histórico ($X–$Y)"** y la planilla se marca con observación.
- Dado que NO hay historial para ese paciente/tipo, Entonces se compara contra la tarifa configurada del paciente (`active_service.shift_tariffs[tipo].cost`) o, si no la tiene, contra el catálogo (`ShiftTypeDef.default_cost`); ver P-1 y P-4.
- Dado un monto dentro del rango, Entonces no se marca.

**Móvil:** la marca OBSERVADO y su motivo visibles en la columna Alertas y en el detalle (H9) sin desbordar.
**Notas técnicas:** al procesar, construir por paciente+tipo el min/max de montos de turnos pagados. Calibración clave para no llenar de falsas alarmas (P-1).
**Riesgo:** medio (calibración de rango).

---

### H14 — OBSERVADO: tope 24h, Control A (tarifa/hora proyectada a 24h) (Fase 3.2 A)
**Como** administrador **quiero** que se avise cuando pagar un turno por horas, proyectado a 24 horas, sale más caro que la tarifa H24 del paciente **para** detectar tarifas por hora mal pactadas.

**Criterios de aceptación**
- Referencia = tarifa H24 del paciente (`shift_tariffs['H24'].cost`) o la del catálogo si el paciente no la tiene (P-4).
- Dado un turno con tarifa por hora, Cuando `tarifa_por_hora × 24 > H24_referencia`, Entonces queda **OBSERVADO: "A $5/hora, 24 horas costarían $120, más que el H24 ($110)"** (con los montos reales).
- Dado que el total real del turno por horas ya supera por sí solo la tarifa H24, Entonces también queda OBSERVADO.
- El aviso ocurre en dos momentos: **al programar/editar** el turno en la agenda (aviso en el formulario) y **al procesar** la planilla (marca en Alertas).
- Dado que la proyección no supera el H24, Entonces no se marca.
- Caso borde (P-8): definir si la comparación es estricta (`>`) o con un pequeño margen para evitar falsas alarmas por redondeo.

**Móvil:** aviso en el formulario de turno (Calendar) y marca en Planillas, ambos legibles.
**Notas técnicas:** para HORAS, `pay_amount = rate × duration_hours` (`types/index.ts:196`); la "tarifa por hora" = `pay_amount / duration_hours`. Agenda: `Calendar.tsx` formulario de turno.
**Riesgo:** medio.

---

### H15 — OBSERVADO: tope 24h, Control B (suma de turnos del mismo día) (Fase 3.2 B)
**Como** administrador **quiero** que si en un mismo día hay varios turnos del mismo paciente cuya suma supera un H24, todos queden OBSERVADO **para** detectar cuando convenía programar un H24 o hubo un error.

**Criterios de aceptación**
- Dado un mismo día con 2 o más turnos del mismo paciente (día+noche, varios por horas, etc.), Cuando la suma de lo pagado supera la tarifa H24 del paciente (o catálogo, P-4), Entonces **todos** los turnos de ese día quedan **OBSERVADO: "Los turnos de este día suman $X, más que cubrir las 24 horas con un H24 ($Y)"**.
- El control corre al procesar la planilla y también como aviso en la agenda al programar el segundo turno del día para ese paciente.
- Dado un solo turno en el día, Entonces este control no aplica.
- Caso borde: turnos `cancelled`/`replaced` no suman.

**Móvil:** marca visible en cada turno del día en el detalle; aviso en agenda legible.
**Notas técnicas:** agrupar turnos por `patient_id` + fecha (día calendario). Cuidado con turnos H24 que cruzan medianoche (P-9).
**Riesgo:** medio.

---

### H16 — OBSERVADO: monto $0 o sin tarifa + tarifas de respaldo desde el catálogo (Fase 3.3)
**Como** administrador **quiero** que un turno con pago $0 o sin tarifa se marque OBSERVADO y que las tarifas de respaldo salgan del catálogo **para** que ningún turno se pague $0 en silencio.

**Criterios de aceptación**
- Dado un turno con pago $0 o sin tarifa configurada, Entonces queda **OBSERVADO: "Turno sin tarifa configurada"**.
- Dado que un turno no tiene `pay_amount`, Entonces la tarifa de respaldo se toma del catálogo (`ShiftTypeDef.default_cost`), **no** de los valores fijos $50/$60/$110 hoy en `calculateRate` (`Payroll.tsx:424-431`).
- Dado un turno por horas sin monto, Entonces se marca OBSERVADO en vez de pagarse $0 silenciosamente.
- Caso borde: si el catálogo tampoco tiene tarifa para ese tipo, se marca OBSERVADO igual.

**Móvil:** marca visible en Alertas y detalle.
**Notas técnicas:** reemplazar los literales de `calculateRate` (`:424-431`) por lectura del catálogo de tipos de turno (`ShiftTypeDef`, editable en Configuración → Tarifas).
**Riesgo:** medio (toca el cálculo del monto; probar que no cambie montos ya correctos).

---

### H17 — Confirmación extra al aprobar una planilla con OBSERVADO (Fase 3 + Fase 5.4)
**Como** administrador **quiero** que aprobar una planilla que tiene turnos OBSERVADO me pida una confirmación adicional **para** no aprobar sin querer montos anómalos, pero sin que el sistema me bloquee.

**Criterios de aceptación**
- Dado una planilla con al menos un turno OBSERVADO, Cuando pulso "Aprobar", Entonces aparece una confirmación que enumera (o resume) las observaciones y me deja continuar o cancelar.
- Dado que confirmo, Entonces la planilla se aprueba normalmente (OBSERVADO nunca bloquea; P-3).
- Dado una planilla sin observaciones, Entonces se aprueba sin confirmación extra.
- Dado el flujo operativo (Fase 5), Entonces las planillas con OBSERVADO se distinguen visualmente para revisarlas antes que las "limpias".

**Móvil:** diálogo de confirmación tocable y legible.
**Notas técnicas:** engancha en `handleApprove` (`Payroll.tsx:370`) usando la marca de observación de H13–H16, H18, H19.
**Riesgo:** bajo.

---

### H18 — OBSERVADO: enfermera con más de 24h en un día o traslape (Fase 6.7)
**Como** administrador **quiero** que si los turnos de una misma enfermera en un mismo día suman más de 24 horas o se traslapan en horario, todos queden OBSERVADO **para** detectar turnos duplicados por error de digitación.

**Criterios de aceptación**
- Dado los turnos de una misma enfermera en un mismo día, Cuando su duración total supera 24 horas o dos turnos se solapan en horario, Entonces todos esos turnos quedan **OBSERVADO** con motivo explicativo.
- Dado turnos que no se traslapan y suman ≤ 24h, Entonces no se marcan.
- Caso borde: turnos `cancelled`/`replaced` no cuentan.
- Caso borde: turno nocturno que cruza medianoche debe evaluarse por su rango real, no por fecha de inicio (P-9).

**Móvil:** marca visible por turno.
**Notas técnicas:** agrupar por `nurse_id` + día; comparar `start_at`/`end_at`.
**Riesgo:** medio.

---

### H19 — OBSERVADO: pago mayor que el cobro (margen negativo) (Fase 6.8)
**Como** administrador **quiero** que si a la enfermera se le paga más de lo que se le cobra al cliente por ese turno, se marque OBSERVADO **para** detectar márgenes negativos.

**Criterios de aceptación**
- Dado un turno con pago (`pay_amount`) mayor que el cobro (`bill_amount`), Entonces queda **OBSERVADO: "Se paga $X y se cobra $Y"**.
- Dado pago ≤ cobro, Entonces no se marca.
- Caso borde (P-10): si el turno no tiene cobro definido (`bill_amount` = 0 o ausente porque aún no se factura), no marcar margen negativo (evitar falsa alarma) — confirmar comportamiento.

**Móvil:** marca visible con ambos montos.
**Notas técnicas:** comparar `Shift.pay_amount` vs `Shift.bill_amount` (`types/index.ts:188-189`).
**Riesgo:** bajo–medio.

---

### H20 — Ajustes controlados por período (Fase 6.10)
**Como** administrador **quiero** que los ajustes/anticipos se apliquen solo al período que corresponde y se detallen antes de aprobar **para** no arrastrar ajustes viejos a la planilla equivocada.

**Contexto:** hoy los ajustes pendientes se aplican TODOS a la siguiente planilla de la enfermera sin importar de cuándo son.

**Criterios de aceptación**
- Dado ajustes/anticipos pendientes de una enfermera, Cuando proceso una planilla, Entonces solo se aplican los ajustes que correspondan a ese período (según su fecha), no todos los pendientes.
- Dado el resumen previo a aprobar, Entonces los ajustes aplicados aparecen detallados (concepto, monto, fecha) para revisarlos.
- Caso borde: un ajuste sin período/fecha asignable debe tener una regla clara (ver P-7): proponer que quede visible como "sin período" para decidir manualmente, no que se cuele silenciosamente.

**Móvil:** resumen de ajustes legible en el detalle antes de aprobar.
**Notas técnicas:** filtrar `adjustments` por período en vez de por "pendiente"; ya hay lógica parcial de asociación por `applied_payroll_id` (`Payroll.tsx:208-213`).
**Riesgo:** medio.

---

# BACKLOG — Fuera del alcance de esta iteración (Fase 6, tercera ronda)

> El plan las marca como "tercera ronda". Se documentan para no perderlas; **no se implementan ahora**.

- **B1 — Turnos en el borde del rango (Fase 6.3).** Al procesar, avisar si hay turnos realizados hasta 3 días antes/después del rango elegido que no caen dentro ("verifique que el rango sea correcto").
- **B2 — Widget en el Dashboard (Fase 6.4).** Tarjeta permanente "Pagos pendientes" con el total de turnos realizados sin planilla de TODOS los períodos; un clic lleva a la lista. (`src/views/Dashboard.tsx`).
- **B3 — Checklist de cierre (Fase 6.5).** Al cerrar un período, acta final: turnos del calendario vs pagados vs cancelados, números frente a frente antes de confirmar.
- **B4 — Total de quincena fuera de lo normal (Fase 6.9).** OBSERVADO a nivel planilla si el total de una enfermera supera en más de 30% su promedio de quincenas anteriores.
- **B5 — Candado en turnos ya pagados (Fase 6.11).** Un turno de una planilla pagada no se puede editar (fecha, tarifa, paciente) ni eliminar sin advertencia fuerte.
- **B6 — Bitácora de auditoría (Fase 6.12).** Registrar quién y cuándo marcó realizado, aprobó, pagó, anuló o editó una tarifa.

---

# PREGUNTAS ABIERTAS (ambigüedades y decisiones a confirmar)

> Cada una con recomendación por defecto para que el administrador solo confirme o corrija.

**P-1 — Rango histórico: ¿min–max estricto o ±%? (H13)**
El plan dice "mayor al máximo o menor al mínimo histórico" → estricto. Riesgo: con 1–2 datos, cualquier variación normal dispara OBSERVADO (falsas alarmas, riesgo señalado en el propio plan para el Paso 5).
**Recomendación:** usar min–max estricto **pero** exigir un mínimo de historial (p. ej. ≥3 turnos pagados de ese paciente/tipo); con menos historial, comparar contra la tarifa configurada (P-4) con una tolerancia pequeña (p. ej. ±5–10%). Confirmar el umbral.

**P-2 — Período con turnos realizados pero SIN planillas: ¿qué estado? (H5)**
Hoy `getPeriodStatus` con 0 runs devuelve "Borrador". Si hay realizados sin procesar, "Borrador" oculta el problema.
**Recomendación:** si `pendientes > 0`, mostrar **INCOMPLETO** aunque no exista ninguna planilla, para que la alerta salga desde el primer turno realizado.

**P-3 — ¿OBSERVADO bloquea el pago? (H17)**
El plan es explícito: **NO bloquea**, solo pide confirmación extra al aprobar.
**Recomendación:** confirmado — implementar como confirmación adicional, nunca como bloqueo. Se documenta aquí solo para dejarlo por escrito.

**P-4 — Paciente/tipo sin historial ni tarifa configurada: ¿referencia? (H13–H15)**
El plan indica: historial → tarifa del paciente → catálogo.
**Recomendación:** cadena de respaldo paciente → catálogo (`ShiftTypeDef.default_cost`); si NINGUNA existe, marcar OBSERVADO "sin tarifa de referencia" en vez de asumir un número. Confirmar.

**P-5 — Definición de "enPlanilla": ¿qué estados de planilla cuentan como vigentes? (H4)**
El plan dice "planillas vigentes (no anuladas)".
**Recomendación:** cuenta como enPlanilla cualquier planilla NO `void` (incluye `draft`, `calculated`, `approved`, `paid`), porque el turno ya tiene `payroll_included = true`. Solo `void` libera. Confirmar (afecta si un `draft` a medio hacer "tapa" la alerta).

**P-6 — Alcance temporal de la conciliación y de los vencidos: ¿todos los períodos o un límite? (H6, H12)**
Retroactivo total puede ser pesado en el teléfono y traer "ruido" muy antiguo.
**Recomendación:** conciliación (H4/H12) por período navegado (sin límite, es liviana); alerta de vencidos (H6) y futuro widget global limitados a, p. ej., últimos 6–12 meses. Confirmar el horizonte.

**P-7 — Ajustes sin período/fecha asignable (H20).**
Al filtrar ajustes por período, ¿qué pasa con ajustes antiguos sin fecha clara?
**Recomendación:** mostrarlos en un apartado "Ajustes sin período — aplicar manualmente" en el resumen, para que el administrador decida; nunca aplicarlos de forma automática y silenciosa.

**P-8 — Comparaciones de tope: ¿estrictas o con margen? (H14, H15, H18)**
Comparar `>` exacto puede disparar OBSERVADO por centavos de redondeo.
**Recomendación:** aplicar un margen pequeño (p. ej. tolerancia de $1 o 1–2%) para evitar falsas alarmas por redondeo. Confirmar el margen.

**P-9 — Turnos que cruzan medianoche (noche / H24) en agrupaciones por día (H15, H18).**
¿Se agrupan por fecha de inicio o por rango real?
**Recomendación:** agrupar por rango real de horas (`start_at`–`end_at`) para el traslape y el tope; para el Control B (suma del día) usar el día de inicio del turno y documentarlo. Confirmar.

**P-10 — Pago > cobro cuando el turno aún no tiene cobro (H19).**
Si `bill_amount` es 0/ausente porque aún no se factura, comparar daría "margen negativo" falso.
**Recomendación:** no marcar margen negativo cuando no hay cobro definido; marcarlo solo si `bill_amount > 0` y `pay_amount > bill_amount`. Confirmar.

**P-11 — Mecanismo de "aviso visual (toast)" (H2, H3, H7, H8).**
Verificado: **la app no tiene sistema de toasts**; hoy usa `window.alert`/`window.confirm` y badges de estado.
**Recomendación:** para avisos de éxito no bloqueantes (aprobar, pagar, anular, cambio de estado en agenda) introducir un toast ligero reutilizable; reservar `window.confirm` para las confirmaciones que sí deben interrumpir (forzar reprocesamiento H8, aprobar con OBSERVADO H17). Confirmar si se acepta añadir un componente de toast pequeño.

**P-12 — Reproceso manual de julio 2026 (operativo, sin código).**
El plan indica re-procesar el período 01–15 JUL 2026 abriendo "Procesar Período" con esas fechas y procesando los "listos", **sin** activar "Forzar reprocesamiento" (duplicaría pagos).
**Recomendación:** ejecutarlo tras desplegar la Entrega 1 (H1) para que los turnos huérfanos de anulaciones ya estén liberados; confirmar que se hace manualmente y bajo supervisión.
