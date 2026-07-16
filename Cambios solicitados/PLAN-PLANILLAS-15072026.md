# Plan: Auditoría y Control de Planillas — 15/07/2026

**Origen:** en producción, la planilla del período 01–15 JUL 2026 pagó 35 turnos pero el calendario tiene 60 turnos REALIZADOS en ese rango. ~25 turnos quedaron "en el aire" sin que el sistema avisara, y el período aparece como CERRADO.

**Objetivo:** que ningún turno realizado quede sin pagar en silencio, que los montos fuera de lo normal se marquen como OBSERVADO antes de pagar, y que la revisión de pago se pueda hacer completa sin salir de la pantalla de planillas.

---

## Fase 1 — Correcciones urgentes (errores confirmados)

### 1.1 Anular planilla debe liberar sus turnos
- **Problema:** `handleVoid` (`src/views/Payroll.tsx:406`) marca la planilla como anulada pero NO limpia `payroll_included` / `payroll_run_id` de los turnos. Además el asistente de procesar (`activeRunIds`, `Payroll.tsx:2119`) cuenta las planillas anuladas como vigentes. Resultado: los turnos de una planilla anulada quedan bloqueados para siempre y nunca se vuelven a pagar.
- **Corrección:**
  - Al anular, liberar los turnos igual que al eliminar (`Payroll.tsx:412-419` ya lo hace bien).
  - En el asistente, excluir las planillas con `status === 'void'` de `activeRunIds`, para que los turnos atrapados por anulaciones viejas se detecten como "huérfanos" y se liberen solos.
- **Riesgo:** bajo. No toca montos ni pagos existentes.

### 1.2 Retroalimentación al aprobar (el "menú que no se oculta")
- **Problema:** en el detalle de planilla, el botón "Aprobar" (`Payroll.tsx:1802-1806`) actualiza la lista pero `selectedPayroll` es una copia vieja: la ventana sigue mostrando "Calculado" y el botón "Aprobar" sigue visible. No hay forma de saber si funcionó.
- **Corrección:**
  - Derivar `selectedPayroll` de la lista actual (buscar por id en `payrollRuns` al renderizar) para que el estado cambie en vivo a "Aprobado" y el botón desaparezca.
  - Agregar un aviso visual (toast) "Planilla aprobada ✓" en todas las acciones de estado: Aprobar, Registrar Pago, Anular, tanto en el menú ⋮ como en el detalle.
  - En la agenda, al Confirmar / Marcar Realizado / Cancelar / Reemplazar, mismo criterio: la etiqueta de estado del panel se actualiza en vivo y se muestra el aviso.
- **Riesgo:** bajo. Solo interfaz.

---

## Fase 2 — Auditoría de turnos "en el aire" (conciliación automática)

La regla de oro: **el sistema compara siempre calendario vs planillas y avisa la diferencia.** Hoy nadie compara; esa es la raíz del problema de julio.

### 2.1 Alerta de conciliación en el período
- Al abrir la pestaña Planillas, para el período seleccionado calcular:
  - `realizados` = turnos con estado REALIZADO cuya fecha cae en el período.
  - `enPlanilla` = turnos incluidos en planillas vigentes (no anuladas) del período.
  - `pendientes` = realizados − enPlanilla.
- Si `pendientes > 0`: banner rojo permanente: **"⚠ Hay X turnos realizados sin planilla en este período"** con botón "Ver turnos" y botón "Procesar ahora" (abre el asistente ya con las fechas del período).

### 2.2 El estado del período debe reflejar la realidad
- Hoy `getPeriodStatus` solo mira las planillas existentes: si las 10 están pagadas dice CERRADO aunque falten 25 turnos.
- Cambio: si hay `pendientes > 0`, el período muestra **"INCOMPLETO"** (naranja) en lugar de CERRADO. Solo muestra CERRADO cuando pendientes = 0 y todas las planillas están pagadas.

### 2.3 Lista de turnos pendientes (detalle de la diferencia)
- Al pulsar "Ver turnos": lista con fecha, enfermera, paciente, tipo de turno y monto de cada turno realizado sin planilla, para decidir si se procesa o si el turno estaba mal marcado.

### 2.4 Auditoría retroactiva al desplegar
- La primera vez que entre esta versión, la alerta de conciliación aplicará también a períodos anteriores (mayo, junio): al navegar a cada período se verá si quedaron turnos sin pagar hacia atrás.

---

## Fase 3 — Validación de montos: marca "OBSERVADO"

Antes de que una planilla se pueda aprobar, cada turno pasa tres controles. El que falle no bloquea, pero marca el renglón y la planilla con **OBSERVADO** en la columna ALERTAS (ya existe en la tabla, hoy siempre vacía). Una planilla con observaciones pide confirmación extra al aprobar.

### 3.1 Fuera del rango histórico de pago
- Al procesar, comparar el monto del turno contra el historial de turnos **ya pagados** del mismo paciente y mismo tipo de turno.
- Si el monto es mayor al máximo histórico o menor al mínimo histórico → **OBSERVADO: "Pago fuera del rango histórico ($X–$Y)"**.
- Si no hay historial para ese paciente/tipo, comparar contra la tarifa configurada del paciente o el catálogo.

### 3.2 Tope de 24 horas (dos controles)

La referencia siempre es la **tarifa H24 del paciente** (o la del catálogo si el paciente no tiene configurada).

**Control A — Tarifa por hora proyectada a 24 horas:**
- Cálculo: `tarifa por hora × 24` y se compara contra la tarifa H24 del paciente.
- Ejemplo: si se paga $5/hora → $5 × 24 = $120; si el H24 del paciente es $110, la tarifa por hora sale más cara que el turno completo → **OBSERVADO: "A $5/hora, 24 horas costarían $120, más que el H24 ($110)"**.
- Se avisa en dos momentos: **al programar/editar** el turno en la agenda (aviso en el formulario, para corregir la tarifa antes de que exista) y **al procesar** la planilla (marca en ALERTAS).
- También se valida el monto real del turno: si el total del turno por horas ya supera por sí solo la tarifa H24 → **OBSERVADO**.

**Control B — Suma de turnos del mismo día:**
- Si un mismo día hay **2 o más turnos para el mismo paciente** (día + noche, varios por horas, por horas + noche, etc.), se suma lo que se paga por todos.
- Si la suma supera la tarifa H24 del paciente → todos los turnos de ese día quedan **OBSERVADO: "Los turnos de este día suman $X, más que cubrir las 24 horas con un H24 ($Y)"**.
- Lógica: si entre varios turnos ya se cubre el día completo pagando más que un H24, o se pactó mal la tarifa o convenía programar un H24.
- Este control corre al procesar la planilla y también como aviso en la agenda al programar el segundo turno del día.

### 3.3 Montos en cero o sin tarifa
- Turno con pago $0 o sin tarifa → **OBSERVADO: "Turno sin tarifa configurada"**. (Hoy un turno por horas sin monto se paga $0 en silencio.)
- Complemento: las tarifas de respaldo fijas del código ($50/$60/$110) se reemplazan por las del catálogo de tipos de turno.

---

## Fase 4 — Revisar el pago sin ir a la agenda

### 4.1 Detalle de planilla con contexto completo
- En el detalle de cada planilla, por cada turno mostrar: **fecha, paciente, tipo de turno, tarifa y observaciones** (hoy el recibo impreso ya muestra el paciente, pero la pantalla de revisión no).
- Así, al aprobar o pagar, se ve de un vistazo a qué pacientes corresponde cada turno cobrado.

### 4.2 Resumen por paciente
- En el mismo detalle, un renglón resumen: "3 turnos con Cristina Perla ($150), 2 con Héctor Medrano ($220)…" para detectar rápido un turno asignado al paciente equivocado.

---

## Fase 5 — Flujo de revisión propuesto (operativo)

1. **Durante la quincena:** marcar los turnos REALIZADOS al día (idealmente el mismo día o al día siguiente).
2. **Al cierre (día 15 / fin de mes):** entrar a Planillas → el período debe estar sin alerta roja. Si hay alerta, resolver los turnos pendientes primero (procesarlos o corregirlos).
3. **Procesar Período** → revisar planillas con OBSERVADO antes que las limpias.
4. **Aprobar** cada planilla (con confirmación extra si tiene observaciones) → **Registrar Pago**.
5. El período pasa a **CERRADO** solo cuando: 0 turnos pendientes + todas las planillas pagadas. Si después alguien marca un turno viejo como realizado, el período vuelve solo a INCOMPLETO y aparece la alerta.

---

## Fase 6 — Blindajes adicionales

Revisión completa del flujo buscando todo camino por donde un pago pueda quedar fuera o salir demasiado alto.

### 6.A Para que ningún pago quede fuera

1. **Turnos vencidos sin resolver.** Un turno con fecha pasada que sigue en PROGRAMADO, CONFIRMADO, REEMPLAZADO o INCIDENCIA nunca entra a planilla y hoy nadie lo ve. Alerta permanente: "X turnos con fecha vencida sin marcar como Realizado o Cancelado", con lista para resolverlos uno a uno. Es la otra mitad del problema de julio: la conciliación (Fase 2) encuentra los realizados sin pagar; esto encuentra los que ni siquiera llegaron a realizados.
2. **Aviso al marcar Realizado tarde.** Si se marca REALIZADO un turno cuyo período ya tiene planillas pagadas, aviso inmediato: "Este turno quedó fuera de la planilla ya pagada; el período volverá a INCOMPLETO hasta que lo procese". Así el aviso llega en el momento, no al cierre siguiente.
3. **Turnos en el borde del rango.** Al procesar, si hay turnos realizados hasta 3 días antes/después del rango elegido que no caen dentro, avisar: "Hay X turnos realizados justo fuera de estas fechas — verifique que el rango sea correcto". Evita perder turnos por un rango mal puesto.
4. **Widget en el Dashboard.** Tarjeta permanente "Pagos pendientes": total de turnos realizados sin planilla de TODOS los períodos (no solo el visible). Si dice 0, todo está pagado; si no, un clic lleva a la lista.
5. **Checklist de cierre.** Al cerrar un período, resumen final tipo acta: turnos del calendario vs turnos pagados vs cancelados, con los números frente a frente antes de confirmar.

### 6.B Para que ningún pago salga demasiado alto

6. **Detector de doble pago.** Auditoría automática: si el mismo turno aparece en 2 o más planillas vigentes (posible con "Forzar reprocesamiento"), alerta crítica en rojo con las dos planillas señaladas. Además, "Forzar reprocesamiento" pedirá una confirmación explícita advirtiendo que puede duplicar pagos.
7. **Enfermera con más de 24 horas en un día.** Si los turnos de una misma enfermera en un mismo día suman más de 24 horas o se traslapan en horario (físicamente imposible), todos quedan OBSERVADO. Detecta turnos duplicados por error de digitación.
8. **Pago mayor que el cobro.** Si a la enfermera se le paga más de lo que se le factura al cliente por ese turno (margen negativo) → OBSERVADO: "Se paga $X y se cobra $Y".
9. **Total de quincena fuera de lo normal.** Si la planilla de una enfermera supera en más de un 30% su promedio de quincenas anteriores → OBSERVADO a nivel planilla: "Total inusualmente alto vs su historial".
10. **Ajustes controlados por período.** Hoy los ajustes/anticipos pendientes se aplican TODOS a la siguiente planilla de la enfermera sin importar de cuándo son. Se filtrarán por período y aparecerán detallados en el resumen antes de aprobar.
11. **Candado en turnos ya pagados.** Un turno que pertenece a una planilla pagada no se puede editar (fecha, tarifa, paciente) ni eliminar sin una advertencia fuerte; el recibo emitido debe seguir cuadrando con el calendario.
12. **Bitácora de auditoría.** Registrar quién y cuándo: marcó realizado, aprobó, pagó, anuló, editó una tarifa. Ante cualquier descuadre futuro, se podrá reconstruir qué pasó (hoy es imposible saberlo).

### Prioridad sugerida dentro de la Fase 6
- Inmediatos (van con Fase 2): puntos 1, 2 y 6 — cierran los huecos más peligrosos.
- Segunda ronda (van con Fase 3): puntos 7, 8 y 10.
- Tercera ronda: 3, 4, 5, 9, 11 y 12.

---

## Orden de ejecución y alcance

| Paso | Contenido | Riesgo |
|------|-----------|--------|
| 1 | Fase 1 completa (bugs: anular + feedback de aprobar) | Bajo |
| 2 | Fase 2.1 y 2.2 + Fase 6 puntos 1, 2 y 6 (conciliación, INCOMPLETO, turnos vencidos, doble pago) | Bajo — solo lectura de datos |
| 3 | Fase 4 (paciente visible en detalle de planilla) | Bajo |
| 4 | Fase 2.3 y 2.4 (lista de pendientes + retroactivo) | Bajo |
| 5 | Fase 3 (validaciones OBSERVADO) + Fase 6 puntos 7, 8 y 10 | Medio — hay que calibrar los rangos para no llenar todo de falsas alarmas |
| 6 | Fase 6 resto (bordes de rango, widget, checklist, candado, bitácora) | Bajo–Medio |

Cada paso se sube por separado y se prueba en producción antes del siguiente.

**Pendiente inmediato (manual, sin código):** re-procesar el período 01–15 JUL 2026 para pagar los ~25 turnos que quedaron fuera — abrir "Procesar Período" con fechas 01/07–15/07, revisar la vista previa y procesar los "listos". **No activar "Forzar reprocesamiento"** (duplicaría pagos).
