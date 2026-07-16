# DESIGN.md — Auditoría y Control de Planillas

> Extiende el sistema de diseño existente (`src/index.css`, `Payroll.css`, `Calendar.css`). **No se
> crean tokens ni componentes nuevos fuera de los listados aquí.** Todo color es una variable CSS ya
> definida; todo layout reutiliza clases ya existentes (`badge`, `period-status-badge`,
> `period-kpi-card`, `action-menu-dropdown`, `table-wrapper`, `mobile-cards`/`entity-card`,
> `drawer-section`, `font-mono`). Mobile-first, `<768px` es el caso de uso principal (admin desde el
> teléfono). Modo oscuro automático vía `:root[data-theme="dark"]` — nunca hardcodear color.

**Paleta de severidad usada en todo el feature** (ya existente, no nueva):
- Crítico / bloqueante en dinero → `--error-500/600/700` + `--error-50` de fondo.
- Observado / advertencia → `--warning-500/600/700` + `--warning-50` de fondo.
- Éxito / confirmado → `--success-500/600/700` + `--success-50` de fondo.
- Informativo → `--info-500/600/700` + `--info-50` de fondo.
- Montos: siempre `className="font-mono"` (monospace, `Reports.css`) + alineados a la derecha
  (`text-right` o `td { text-align:right }`); negativos (deducciones, ajustes tipo `deduction`) en
  `--error-600`.

---

## 1. Toast (`components/ui/Toast.tsx`)

**Posición:** `fixed`, centrado horizontal, **debajo del TopBar** para no tapar el logo/búsqueda ni
quedar detrás del teclado móvil. TopBar mide su propia altura por CSS; el toast usa `top` con margen
fijo generoso que funciona en desktop y móvil sin medir el DOM.

```html
<div class="toast-viewport" aria-live="polite" aria-atomic="false">
  <div class="toast toast-success" role="status">
    <CheckCircle2 size={18} class="toast-icon" />
    <span class="toast-message">Planilla aprobada</span>
    <button class="toast-close" aria-label="Cerrar aviso"><X size={14}/></button>
  </div>
  <!-- toasts adicionales se apilan debajo, más nuevo arriba -->
</div>
```

CSS (nuevo, mínimo, en `components/ui/Toast.css`, solo variables existentes):

```css
.toast-viewport {
  position: fixed;
  top: 72px;                 /* debajo del TopBar en desktop y móvil */
  left: 50%;
  transform: translateX(-50%);
  z-index: 1100;             /* por encima de .modal-overlay (1000) */
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  width: min(420px, calc(100vw - var(--spacing-6)));
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3) var(--spacing-4);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-main);
  animation: slideTop 0.2s ease-out;
  min-height: 44px;
}

.toast-success { border-left: 4px solid var(--success-500); }
.toast-success .toast-icon { color: var(--success-600); }
.toast-error   { border-left: 4px solid var(--error-500); }
.toast-error   .toast-icon { color: var(--error-600); }
.toast-warning { border-left: 4px solid var(--warning-500); }
.toast-warning .toast-icon { color: var(--warning-600); }
.toast-info    { border-left: 4px solid var(--info-500); }
.toast-info    .toast-icon { color: var(--info-600); }

.toast-message { flex: 1; }
.toast-close { min-width: 32px; min-height: 32px; display: flex; align-items: center;
  justify-content: center; border: none; background: transparent; color: var(--text-muted); }

@media (max-width: 640px) {
  .toast-viewport { top: 64px; width: calc(100vw - var(--spacing-4)); }
}
```

- **Autocierre:** 3.5 s (éxito/info), 5 s (error/warning, dan más tiempo de lectura).
- **Apilado:** máximo 3 visibles; el 4º reemplaza el más viejo (evita spam en pantalla pequeña).
- **Cierre manual:** botón X (44×44 objetivo táctil vía padding, icono 14px centrado) o tap en cualquier
  parte del toast.
- **Accesible:** `aria-live="polite"` en el contenedor (no interrumpe lectores de pantalla a media
  frase); cada toast es `role="status"`. Nunca usar color como único indicador: siempre acompaña icono
  (`CheckCircle2`/`XCircle`/`AlertTriangle`/`Info` de `lucide-react`, ya usados en la app).
- **Modo oscuro:** hereda `--bg-card`/`--border-color`/`--text-main` — sin overrides adicionales.

---

## 2. Banner de conciliación (H4, dentro de `Payroll.tsx`)

Se coloca **arriba de la tabla de planillas**, debajo de `period-control-bar` / `period-kpi-strip`,
siempre visible mientras `pendientes > 0` (persistente, no descartable — es la alerta raíz del
problema de julio).

```html
<div class="audit-banner audit-banner-danger">
  <AlertTriangle size={20} class="audit-banner-icon" />
  <div class="audit-banner-text">
    <strong>Hay 7 turnos realizados sin planilla en este período</strong>
    <span>Estos turnos no se han pagado. Revíselos antes de cerrar el período.</span>
  </div>
  <div class="audit-banner-actions">
    <button class="btn btn-outline-danger">Ver turnos</button>
    <button class="btn btn-danger">Procesar ahora</button>
  </div>
</div>
```

CSS (nuevo, específico del feature, en `Payroll.css`):

```css
.audit-banner {
  display: flex;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
  border-radius: var(--radius-lg);
  border: 1px solid;
}
.audit-banner-icon { flex-shrink: 0; }
.audit-banner-text { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.audit-banner-text strong { font-size: var(--font-size-sm); }
.audit-banner-text span { font-size: 12px; color: var(--text-muted); }
.audit-banner-actions { display: flex; gap: var(--spacing-2); flex-shrink: 0; }

.audit-banner-danger {
  background: var(--error-50); border-color: var(--error-200, #fecaca);
}
.audit-banner-danger .audit-banner-icon { color: var(--error-600); }
.audit-banner-danger .audit-banner-text strong { color: var(--error-700); }

/* H8 doble pago reutiliza el mismo banner con modificador crítico (mismo color, ya es el máximo) */
.audit-banner-critical { background: var(--error-50); border-color: var(--error-500); border-width: 2px; }

/* H6 vencidos: mismo patrón, tono naranja (no rojo, no implica dinero ya perdido) */
.audit-banner-warning { background: var(--warning-50); border-color: var(--warning-200, #fde68a); }
.audit-banner-warning .audit-banner-icon { color: var(--warning-600); }
.audit-banner-warning .audit-banner-text strong { color: var(--warning-700); }
```

Botones: usar los botones ya existentes de la app (`btn`, variantes `btn-outline-danger`/`btn-danger` si
existen en el proyecto; si no, usar las clases de botón ya usadas en `Payroll.tsx` para acciones
secundarias/peligrosas y mantener el mismo look — no inventar un tercer estilo de botón).

**Móvil (`<768px`):** banner a ancho completo, icono arriba a la izquierda, texto debajo, botones
**apilados verticalmente al 100% de ancho** (mismo patrón que `.modal-footer .btn` en móvil):

```css
@media (max-width: 640px) {
  .audit-banner { flex-direction: column; align-items: flex-start; }
  .audit-banner-actions { flex-direction: column; width: 100%; }
  .audit-banner-actions .btn { width: 100%; justify-content: center; min-height: 44px; }
}
```

Si `pendientes = 0`: el banner no se renderiza (nada de "todo OK" persistente — ya lo comunica el
`period-status-badge`).

---

## 3. Estado de período INCOMPLETO (H5)

Nueva entrada en `PERIOD_STATUS_META` (`Payroll.tsx:196`), reutilizando `.period-status-badge`:

```ts
incompleto: { label: 'Incompleto', color: 'var(--warning-700)', bg: 'var(--warning-50)' },
```

Render (mismo patrón condicional que los demás estados, `Payroll.tsx:640-645`):

```jsx
<div className="period-status-badge" style={{ background: periodStatusMeta.bg, color: periodStatusMeta.color }}>
  {periodStatus === 'incompleto'      && <AlertTriangle size={13} />}
  {periodStatus === 'con_incidencias' && <AlertTriangle size={13} />}
  {periodStatus === 'cerrado'         && <CheckCircle2 size={13} />}
  {periodStatus === 'aprobado'        && <CheckCircle2 size={13} />}
  <span>{periodStatusMeta.label}</span>
</div>
```

`INCOMPLETO` usa el mismo naranja que `EN REVISIÓN` pero **se distingue por el icono** `AlertTriangle`
(igual criticidad visual que `CON INCIDENCIAS`, pero en naranja no rojo — no es un error de datos, es
trabajo pendiente). Precedencia de estados (de más a menos crítico): `con_incidencias` (rojo) >
`incompleto` (naranja) > `en_revision`/`aprobado`/`pagado_parcial` > `cerrado`.

**Móvil:** el badge vive en `period-control-bar`, que ya se apila/envuelve en móvil (`flex-wrap: wrap`)
— sin cambios adicionales de layout.

---

## 4. Columna/indicador de Alertas (H13–H19)

### Desktop — columna "Alertas" de la tabla (`Payroll.tsx:747`, hoy vacía)

Reutiliza `.row-alert-chip` (ya existe en `Payroll.css` para `chip-ajuste`/`chip-anticipo`/`chip-void`):
se agregan dos modificadores nuevos.

```jsx
<td>
  {observaciones.length === 0 ? (
    <span className="text-muted text-xs">—</span>
  ) : (
    <span className={`row-alert-chip ${tieneCritico ? 'chip-critico' : 'chip-observado'}`}>
      <AlertTriangle size={11} /> {tieneCritico ? 'CRÍTICO' : 'OBSERVADO'} {observaciones.length}
    </span>
  )}
</td>
```

```css
.chip-observado { background: var(--warning-50); color: var(--warning-700); }
.chip-critico   { background: var(--error-50);   color: var(--error-700); border: 1px solid var(--error-300, #fca5a5); }
```

### Móvil — pill en `entity-card` (tarjeta de planilla)

En la cabecera o fila de la tarjeta, junto al badge de estado:

```jsx
<div className="entity-card-row">
  <span className="badge calculated">Calculado</span>
  {observaciones.length > 0 && (
    <span className={`row-alert-chip ${tieneCritico ? 'chip-critico' : 'chip-observado'}`}>
      OBSERVADO {observaciones.length}
    </span>
  )}
</div>
```

### Panel de observaciones en el detalle de planilla (drawer)

Nueva `drawer-section` al inicio del detalle (antes del desglose de turnos), visible solo si hay
observaciones — así el admin las ve primero, antes de revisar renglón por renglón:

```jsx
{observaciones.length > 0 && (
  <section className="drawer-section audit-observations">
    <h4 className="section-title flex items-center gap-2">
      <AlertTriangle size={16} style={{ color: 'var(--warning-600)' }} /> Observaciones ({observaciones.length})
    </h4>
    <div className="flex flex-col gap-2">
      {observaciones.map(o => (
        <div key={o.codigo + o.shiftIds.join(',')}
             className={`audit-obs-item ${o.severidad === 'critico' ? 'obs-critico' : 'obs-observado'}`}>
          <AlertTriangle size={14} className="audit-obs-icon" />
          <span className="audit-obs-text">{o.mensaje}</span>
        </div>
      ))}
    </div>
  </section>
)}
```

```css
.audit-obs-item {
  display: flex; align-items: flex-start; gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-md);
  font-size: 13px; font-weight: 600;
}
.audit-obs-item.obs-observado { background: var(--warning-50); color: var(--warning-800, var(--warning-700)); }
.audit-obs-item.obs-observado .audit-obs-icon { color: var(--warning-600); flex-shrink: 0; margin-top: 1px; }
.audit-obs-item.obs-critico   { background: var(--error-50);   color: var(--error-700); border: 1px solid var(--error-300, #fca5a5); }
.audit-obs-item.obs-critico   .audit-obs-icon { color: var(--error-600); flex-shrink: 0; margin-top: 1px; }
```

Cada renglón de turno afectado dentro del desglose (sección H9) también recibe un icono inline junto al
motivo (ver §5) para no obligar al admin a saltar entre el panel y la tabla.

**Móvil:** el panel de observaciones es una lista apilada vertical (ya es el layout natural de
`drawer-section`) — no requiere breakpoint adicional. Texto nunca se corta: `white-space: normal`,
`overflow-wrap: anywhere` si el mensaje incluye montos largos.

---

## 5. Detalle de planilla con paciente (H9/H10)

### Desktop — tabla de renglones (extiende `Payroll.tsx:1653-1732`)

Columnas: **Fecha | Paciente | Tipo | Tarifa | Observación**. `Observación` reemplaza el espacio vacío
actual; muestra el chip `chip-observado`/`chip-critico` (mismo componente de §4) o `—`.

```jsx
<table className="premium-table">
  <thead>
    <tr><th>Fecha</th><th>Paciente</th><th>Tipo</th><th>Tarifa</th><th>Observación</th></tr>
  </thead>
  <tbody>
    {items.map(item => (
      <tr key={item.shift_id} className={item.observado ? 'row-observado' : ''}>
        <td className="text-sm">{formatDate(item.date)}</td>
        <td className="font-medium">{item.patientName || 'Paciente no encontrado'}</td>
        <td className="text-sm">{item.shiftTypeLabel}</td>
        <td className="font-mono text-right">${item.pay_rate.toFixed(2)}</td>
        <td>
          {item.observaciones.length > 0
            ? <span className={`row-alert-chip ${item.critico ? 'chip-critico' : 'chip-observado'}`}>
                {item.observaciones[0].mensaje}{item.observaciones.length > 1 ? ` (+${item.observaciones.length - 1})` : ''}
              </span>
            : <span className="text-muted text-xs">—</span>}
        </td>
      </tr>
    ))}
    {/* Ítems ADJ: sin paciente, ya conserva el comportamiento actual */}
  </tbody>
</table>
```

```css
.row-observado td { background: var(--warning-50); }
```

### Resumen por paciente (H10)

Bloque nuevo, encima o debajo del desglose, dentro de su propia `drawer-section`:

```jsx
<section className="drawer-section">
  <h4 className="section-title">Resumen por paciente</h4>
  <div className="flex flex-col gap-1">
    {resumenPorPaciente.map(r => (
      <div key={r.patientId} className="flex justify-between text-sm">
        <span>{r.count} turno{r.count > 1 ? 's' : ''} con {r.patientName}</span>
        <span className="font-mono font-bold">${r.total.toFixed(2)}</span>
      </div>
    ))}
    {ajustesTotal !== 0 && (
      <div className="flex justify-between text-sm" style={{ color: 'var(--warning-700)' }}>
        <span>Ajustes</span>
        <span className="font-mono font-bold">${ajustesTotal.toFixed(2)}</span>
      </div>
    )}
  </div>
</section>
```

### Móvil — lista apilada (reemplaza la tabla bajo `768px`, mismo patrón `mobile-cards`/`entity-card`
usado en Financials/Catalog/Nurses)

```jsx
<div className="mobile-cards">
  {items.map(item => (
    <div key={item.shift_id} className={`entity-card${item.observado ? ' entity-card-observado' : ''}`}>
      <div className="entity-card-row"><strong>{item.patientName || 'Paciente no encontrado'}</strong>
        <span className="font-mono font-bold">${item.pay_rate.toFixed(2)}</span></div>
      <div className="entity-card-row"><span className="text-muted text-xs">{formatDate(item.date)}</span>
        <span className="text-muted text-xs">{item.shiftTypeLabel}</span></div>
      {item.observaciones.length > 0 && (
        <span className={`row-alert-chip ${item.critico ? 'chip-critico' : 'chip-observado'}`}>
          {item.observaciones[0].mensaje}
        </span>
      )}
    </div>
  ))}
</div>
```

```css
.entity-card-observado { border-left: 3px solid var(--warning-500); }
```

Nombre de paciente **nunca truncado con `...` sin acceso al texto completo**: usar `overflow-wrap:
anywhere` (ya es el patrón de `.entity-card-header .font-bold`), no `text-overflow: ellipsis` sin
`title`.

---

## 6. Avisos en el formulario de turno (ShiftForm, `Calendar.tsx`)

Reutiliza **exactamente** el patrón visual ya existente del aviso de tarifa (`Calendar.tsx:1456-1468`,
hoy verde/naranja según `tariffSource`), en su variante de advertencia, para los tres casos nuevos
(H14 proyección ×24, H15 suma del día, H16 tarifa $0):

```jsx
{avisoObservado && (
  <div style={{
    padding: '8px 12px', borderRadius: 8,
    background: 'var(--warning-50)',
    border: '1px solid var(--warning-200)',
    fontSize: 11, fontWeight: 700,
    color: 'var(--warning-700)',
    display: 'flex', alignItems: 'center', gap: 6,
  }}>
    <AlertTriangle size={13} />
    {avisoObservado.mensaje}
    {/* ej: "A $5/hora, 24 horas costarían $120, más que el H24 ($110)" */}
  </div>
)}
```

- Se ubica **inmediatamente debajo** del bloque de tarifa/monto del formulario (mismo lugar donde hoy
  vive el aviso verde de tarifa), para que el admin lo vea sin scroll extra.
- **No bloquea el guardado** (regla P-3): es informativo, el botón "Guardar turno" permanece habilitado.
- Si hay varios avisos aplicables a la vez (p. ej. H14 y H16), se apilan verticalmente con
  `gap: var(--spacing-2)` entre ellos — mismo estilo cada uno, sin fusionar mensajes.
- Turno sin tarifa ($0, H16): mismo bloque, mensaje `"Turno sin tarifa configurada — se guardará como
  OBSERVADO"`.

**Móvil:** el formulario de turno ya es una sola columna en pantallas pequeñas (`grid-2` colapsa a
`1fr`); el aviso ocupa el ancho completo sin cambios adicionales.

---

## 7. Confirmaciones que mueven dinero (`window.confirm`, H8/H17)

Texto exacto en español, claro para un admin no técnico — sin jerga (`shift_id`, `payroll_run_id`,
etc.), con salto de línea (`\n`) para separar el resumen de la pregunta:

**H8 — Forzar reprocesamiento** (`Payroll.tsx:2162`, dentro de `NewPayrollWizard`):

```
⚠ ADVERTENCIA: Forzar el reprocesamiento puede PAGAR DOS VECES turnos que ya están en otra planilla.

Use esta opción solo si está seguro de que los turnos mostrados NO se han pagado antes.

¿Desea continuar de todas formas?
```

**H17 — Aprobar planilla con observaciones** (`Payroll.tsx:370`, `handleApprove`), enumerando (máx. 5
líneas, luego "y N más" para no desbordar el diálogo nativo en móvil):

```
Esta planilla tiene 3 turno(s) observado(s):

• Pago fuera del rango histórico ($50–$60) — María Torres, 03/07
• Turno sin tarifa configurada — Carlos Núñez, 05/07
• Se paga $75 y se cobra $60 — María Torres, 07/07

Puede aprobarla igual, pero revise estos montos antes de pagar.

¿Aprobar la planilla de todas formas?
```

Si hay una observación `crítico` (doble pago) entre ellas, encabezar con
`🔴 ATENCIÓN: incluye un posible DOBLE PAGO.` antes del listado.

**H1 — Anular planilla** (ya existe el `window.confirm`, sin cambios de texto salvo aclarar que libera
los turnos):

```
¿Anular esta planilla?

Los turnos incluidos volverán a estar disponibles para procesarse en una nueva planilla.
```

`window.confirm` se reserva exclusivamente para estos puntos (mueven o pueden duplicar dinero); todo lo
demás usa el Toast (§1).

---

## 8. Lista de turnos pendientes / vencidos (H6/H11)

Reutiliza `components/ui/Modal.tsx` (overlay + `modal-container`, ya usado en toda la app) — no se crea
un componente de lista nuevo.

```jsx
<Modal isOpen={showPendientes} onClose={...} title="Turnos realizados sin planilla">
  <div className="modal-body">
    {pendientes.length === 0 ? (
      <div className="text-center py-10 text-muted">No hay turnos pendientes en este período.</div>
    ) : (
      <>
        {/* Desktop */}
        <div className="table-wrapper mobile-hide-table">
          <table className="premium-table">
            <thead><tr><th>Fecha</th><th>Enfermera</th><th>Paciente</th><th>Tipo</th><th>Monto</th><th></th></tr></thead>
            <tbody>
              {pendientes.map(s => (
                <tr key={s.id}>
                  <td>{formatDate(s.start_at)}</td>
                  <td>{nurseName(s.nurse_id)}</td>
                  <td>{patientName(s.patient_id)}</td>
                  <td>{shiftTypeLabel(s.shift_type_id)}</td>
                  <td className="font-mono text-right">${s.pay_amount.toFixed(2)}</td>
                  <td><button className="btn-link" onClick={() => irATurno(s.id)}>Ver en agenda</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Móvil */}
        <div className="mobile-cards">
          {pendientes.map(s => (
            <div key={s.id} className="entity-card">
              <div className="entity-card-row"><strong>{patientName(s.patient_id)}</strong>
                <span className="font-mono font-bold">${s.pay_amount.toFixed(2)}</span></div>
              <div className="entity-card-row"><span className="text-muted text-xs">{formatDate(s.start_at)}</span>
                <span className="text-muted text-xs">{nurseName(s.nurse_id)}</span></div>
              <div className="entity-card-actions">
                <button className="icon-btn" title="Ver en agenda" onClick={() => irATurno(s.id)}><ExternalLink size={16}/></button>
              </div>
            </div>
          ))}
        </div>
      </>
    )}
  </div>
  <footer className="modal-footer">
    <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
    <button className="btn btn-primary" onClick={abrirWizardConFechas}>Procesar ahora</button>
  </footer>
</Modal>
```

**H6 (vencidos)** usa el mismo Modal/patrón de lista con columnas **Fecha | Enfermera | Paciente | Tipo
| Estado**, y en vez de "Procesar ahora" cada fila/tarjeta lleva acciones puntuales
(`Marcar Realizado` / `Marcar Cancelado` — botones ya existentes en la agenda, mismo estilo de
`menu-item`). Estado vacío: `"No hay turnos vencidos sin resolver."`.

**Móvil:** modal a pantalla casi completa (`.modal-container` ya tiene la regla `width: 95vw; max-height:
90vh` bajo `768px`); botones del footer apilados full-width (`.modal-footer` ya tiene esa regla bajo
`640px`).

---

## Resumen de clases nuevas a crear (todas sobre tokens existentes)

| Clase | Dónde | Basada en |
|---|---|---|
| `.toast-viewport`, `.toast`, `.toast-success/error/warning/info` | `Toast.css` (nuevo) | `--success/error/warning/info-*`, `--shadow-lg` |
| `.audit-banner`, `.audit-banner-danger/warning/critical` | `Payroll.css` | `--error/warning-50/200/500` |
| `.chip-observado`, `.chip-critico` | `Payroll.css` (junto a `.chip-ajuste` etc.) | `--warning/error-50/700` |
| `.audit-obs-item`, `.obs-observado`, `.obs-critico` | `Payroll.css` | `--warning/error-50/700` |
| `.row-observado`, `.entity-card-observado` | `Payroll.css` | `--warning-50/500` |
| `incompleto` en `PERIOD_STATUS_META` | `Payroll.tsx` | `--warning-700/50` |

Ninguna otra clase, color o componente se introduce fuera de esta lista.
