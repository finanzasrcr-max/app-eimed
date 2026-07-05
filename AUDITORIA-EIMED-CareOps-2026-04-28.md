# Auditoría: EIMED CareOps

**Fecha:** 2026-04-28
**Auditor:** Agente Auditor (sesión solo lectura)
**Alcance:** Auditoría completa sin modificaciones al código

---

## Resumen ejecutivo

Sistema React/TypeScript SPA para gestión de servicios de enfermería domiciliaria (clientes, pacientes, enfermeras, turnos, facturación, planillas, alquileres, ventas de insumos). Está **en producción** desplegado en Vercel con backend Supabase. La arquitectura general es razonable y la integración con Supabase es funcional, pero hay **problemas críticos en el módulo de facturación** que ponen en riesgo la integridad legal y contable de los datos: numeración de facturas no confiable, cobros sin validación de monto, totales con float, escalada de privilegios trivial.

**Intervención urgente recomendada** antes de seguir emitiendo facturas a clientes en El Salvador.

---

## Stack detectado

- **Lenguaje principal:** TypeScript (con muchos `any` mezclados)
- **Framework:** React 19 + Vite 8
- **Routing:** React Router DOM v7
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Persistencia local:** localStorage como caché offline
- **API serverless:** Vercel Functions (`/api/ping`, `/api/send-nurse-report`)
- **Email:** Resend API
- **PDF/exports:** jsPDF + html2canvas + JSZip + xlsx
- **Otros:** date-fns, lucide-react, lodash
- **País / contexto fiscal:** El Salvador (NRC, NIT, IVA 13%)

---

## Top 3 hallazgos más críticos

### 1. Numeración de facturas duplicada y aleatoria en PatientDetail.tsx
En `src/views/PatientDetail.tsx:2199` existe un segundo wizard de facturación que genera el número con `` `FAC-2024-${Math.floor(Math.random()*9000).toString().padStart(4, '0')}` ``. Convive con el wizard de `Financials.tsx` que sí usa correlativos secuenciales. Resultado: dos rutas para emitir facturas con sistemas de numeración incompatibles, año hardcodeado `2024`, y números aleatorios que pueden colisionar. **Esto es ilegal en El Salvador para fines fiscales** y rompe la trazabilidad del correlativo.

### 2. Auto-promoción a Administrador sin restricciones
En `src/views/Settings.tsx:238-250` hay un botón "Hacerme Administrador" que ejecuta `supabase.from('profiles').update({ role: 'admin' }).eq('id', currentProfile.id)`. La política RLS de `supabase_schema.sql:270-272` permite UPDATE de la propia fila sin restringir columnas, así que **cualquier usuario operativo (o cualquiera que cree una cuenta) se hace admin con un click** y queda con acceso total: facturas, planillas, datos de pacientes y enfermeras, recibos, etc. Es escalada de privilegios trivial. La `VITE_SUPABASE_ANON_KEY` además está expuesta en el bundle compilado en `dist/`, así que el atacante no necesita acceso al código.

### 3. Cobros aceptan montos mayores al saldo y eliminación física de facturas
En `src/views/Financials.tsx:176-212` (`handleRegisterPayment`) la única validación es `amount <= 0`. Cobrar más que el saldo deja `balance_amount` negativo y `paid_amount > total_amount`. Además el botón "Eliminar Doc" (Financials.tsx:214-230) borra facturas físicamente del array y de Supabase — **esto no es legal** en sistemas fiscales (las facturas emitidas solo se pueden anular, no eliminar). Y `handleVoidReceipt` (línea 248) anula recibos pero no revierte el `paid_amount` ni el `balance_amount` de la factura, dejando estados inconsistentes.

---

## Hallazgos por gravedad

### CRÍTICOS (atender en días)

**C1. Numeración de facturas duplicada y aleatoria en PatientDetail**
- Qué: segundo NewInvoiceWizard genera `` `FAC-2024-${Math.floor(Math.random()*9000)...}` ``, año hardcoded, sin correlativo.
- Dónde: `src/views/PatientDetail.tsx:2199` (más generación de items con `Math.random().toString()` en 2185, 2188, 2191, 2194).
- Impacto: facturas con números repetidos, año incorrecto en 2025/2026, ilegal fiscalmente, riesgo de duplicar cobros.
- Esfuerzo: 4-8 h.

**C2. Credenciales de Supabase en .env y compiladas en bundle público**
- Qué: `.env` contiene URL real y `VITE_SUPABASE_ANON_KEY`; está en `.gitignore` pero el bundle de Vite la incluye en `dist/assets/index-*.js`. Verificado que sí queda compilada.
- Dónde: `.env`, `src/lib/supabase.ts`, `dist/assets/index-7AfxhHno.js`.
- Impacto: combinada con C3 y RLS laxa, permite acceso administrativo total al sistema desde cualquier navegador.
- Esfuerzo: 2-4 h (rotar key, revisar logs de acceso, ajustar RLS).

**C3. Función "Hacerme Administrador" + RLS permite auto-promoción**
- Qué: cualquier usuario autenticado puede hacer click y ejecutar `update profiles set role='admin' where id = auth.uid()`. La política `"Usuario actualiza su propio perfil"` lo permite porque no restringe columnas.
- Dónde: `src/views/Settings.tsx:238-250` + `supabase_schema.sql:270-272`.
- Impacto: escalada trivial de privilegios.
- Esfuerzo: 2-4 h.

**C4. Cobros aceptan montos mayores al saldo, sin validar factura anulada**
- Qué: `handleRegisterPayment` solo valida `amount <= 0`. Permite saldos negativos y cobros sobre facturas en estado `void`.
- Dónde: `src/views/Financials.tsx:176-212`.
- Impacto: estados financieros incorrectos, recibos por encima del valor real de la factura.
- Esfuerzo: 1-2 h.

**C5. Cálculos monetarios con float64 y `toFixed(2)`**
- Qué: todos los totales usan `number` (`a + b.bill_amount`), reduce sobre arrays de floats. `0.1 + 0.2 = 0.30000000000000004`. Acumulación en meses → diferencias de centavos.
- Dónde: `Financials.tsx:155-158, 184-185`, `Payroll.tsx:206-211, 397, 1468`, `PatientDetail.tsx:2184-2210` y muchos más (146 ocurrencias de `toFixed(2)` en 21 archivos).
- Impacto: descuadres con contabilidad y declaración fiscal.
- Esfuerzo: 8-16 h (helper Money en centavos enteros).

**C6. Eliminación física de facturas ("Eliminar Doc")**
- Qué: el botón ejecuta `setInvoices(invoices.filter(i => i.id !== invoice.id))` que borra físicamente. En SV las facturas emitidas solo se anulan.
- Dónde: `src/views/Financials.tsx:214-230, 747`.
- Impacto: huecos en correlativo, problemas de auditoría fiscal.
- Esfuerzo: 1-2 h.

**C7. Sistema de auditoría es placeholder hardcodeado**
- Qué: 11 ocurrencias de `user: 'Usuario Actual'` hardcoded. Planillas con `approved_by: 'Admin'` literal. Nunca se guarda quién hizo el cambio realmente.
- Dónde: `Patients.tsx:53`, `PatientDetail.tsx:111,142,174,215,249,275,302,326,350`, `QuickAddPatientModal.tsx:64`, `Payroll.tsx:332`.
- Impacto: sin trazabilidad real para auditorías, datos médicos sin saber quién accedió/modificó.
- Esfuerzo: 4-8 h.

### IMPORTANTES (atender en 2-4 semanas)

**I1. RLS laxo: todos los autenticados leen TODO**
- `supabase_schema.sql:282-302`: SELECT abierto a `authenticated` sobre clientes, pacientes, enfermeras, facturas, recibos, planillas. Una enfermera ve datos financieros de toda la empresa.
- Esfuerzo: 8-16 h.

**I2. `useDB` upsert masivo de toda la tabla por cada cambio**
- `src/hooks/useDB.ts:152-170`: modificar 1 turno reescribe TODOS los turnos en Supabase. No escala.
- Esfuerzo: 16-40 h refactor a CRUD granular.

**I3. Archivos enormes con UI + lógica mezclada**
- `PatientDetail.tsx` 3,388 líneas, `Payroll.tsx` 1,978, `Financials.tsx` 1,476, `Calendar.tsx` 1,229, `Settings.tsx` 1,155. La duplicación entre `PatientDetail.NewInvoiceWizard` y `Financials.NewInvoiceWizard` (causa de C1) es síntoma directo.
- Esfuerzo: 40-80 h.

**I4. Validación solo client-side**
- Como Supabase escribe directamente desde el cliente, no hay capa server-side que valide tipos/rangos/coherencia. Sin CHECK constraints en SQL.
- Esfuerzo: 16-40 h.

**I5. IDs con `Math.random()`**
- 51 ocurrencias de `Math.random().toString(36).substr(2, 9)` (substr deprecated). Reemplazar con `crypto.randomUUID()`.
- Esfuerzo: 2-4 h.

**I6. `/api/send-nurse-report` sin autenticación**
- Acepta POSTs sin verificar identidad. Cualquiera con la URL puede enviar emails con PDF arbitrario suplantando a Eimed y consumir cuota de Resend.
- Dónde: `api/send-nurse-report.js`.
- Esfuerzo: 2-4 h.

**I7. CSV exports vulnerables a formula injection**
- `Financials.tsx:143` y `Payroll.tsx:227` no sanitizan valores que empiezan con `=`, `+`, `-`, `@`. Cliente con nombre `=cmd|...` ejecuta al abrir.
- Esfuerzo: 1-2 h.

**I8. Facturas no se marcan como vencidas automáticamente**
- No hay job que actualice `status = 'overdue'` cuando `due_date < hoy`. El cron `/api/ping` cada 5 días solo hace ping a profiles.
- Esfuerzo: 4-6 h.

**I9. Anulación de recibos no revierte pagos**
- `handleVoidReceipt` en `Financials.tsx:248-251` solo cambia `status: 'void'`; no revierte `paid_amount` ni `balance_amount` de la factura.
- Esfuerzo: 2-4 h.

**I10. Conversión cotización → factura sin transacción**
- `handleConvertToInvoice` (Financials.tsx:289-323) hace 3 escrituras independientes (incrementar correlativo, crear factura, marcar cotización). Si falla a la mitad queda inconsistente.
- Esfuerzo: 4-8 h (Edge Function/RPC).

**I11. Tarifas de turno hardcodeadas como fallback**
- `Payroll.tsx:381-388`: `if (DAY) return 50; if (NIGHT) return 60; ...`. Duplica lo que hay en initialData. Si cambian precios, se desincroniza el recálculo.
- Esfuerzo: 2-4 h.

**I12. Print con `setTimeout` arbitrario**
- `setTimeout(() => window.print(), 100|200|600)` en múltiples lugares. Sin esperar fonts ni imágenes. Hay un commit reciente arreglando esto en quotations.
- Esfuerzo: 4-8 h.

**I13. Errores de Supabase silenciados**
- `useDB.ts:172-174`: `console.error` y nada más. Update optimista local ya pasó pero la BD falló — usuario cree que guardó.
- Esfuerzo: 4-8 h.

**I14. Datos personales reales en código (potencialmente)**
- `INITIAL_CLIENTS/PATIENTS/NURSES` en `initialData.ts:35-125` con DUIs, teléfonos, "Banco Agrícola", "Banco Cuscatlán". Si son reales → exposición LEPDP.
- Esfuerzo: 1 h verificar.

### MEJORAS (cuando haya tiempo)

- **M1.** `: any` 78 veces en views.
- **M2.** Sin tests automatizados.
- **M3.** README es el de Vite por defecto.
- **M4.** `services/db.ts` (DatabaseService) es código muerto, nadie lo importa.
- **M5.** Muchos `console.log/error` que llegarán a producción.
- **M6.** `JSON.parse(localStorage)` sin validación de schema.
- **M7.** Modales sin focus trap ni ARIA.
- **M8.** Sin confirmación al cerrar modales con cambios.
- **M9.** Imports masivos de lucide-react aumentan bundle.
- **M10.** `version: 0.0.0` en package.json, sin versionado.
- **M11.** Vercel cron cada 5 días puede no ser suficiente para mantener Supabase activo.
- **M12.** Patient tiene `tariffs` y `active_service.shift_tariffs` duplicado conceptualmente.

---

## Quick wins (< 2 horas cada uno)

1. Quitar botón "Hacerme Administrador" + RLS bloqueando UPDATE de `role` desde uno mismo.
2. Eliminar el segundo NewInvoiceWizard de PatientDetail o redirigir a `/financials`.
3. Validar `amount > balance` y `status !== 'void'` en handleRegisterPayment.
4. Quitar año hardcoded `FAC-2024-...`.
5. Reemplazar `Math.random()` por `crypto.randomUUID()` para IDs.
6. Sanitizar exports CSV (prefijar con `'` valores que empiezan con =, +, -, @).
7. Cambiar "Eliminar Doc" por "Anular".
8. Reemplazar `user: 'Usuario Actual'` por `useAuth().profile?.full_name`.
9. Rotar `VITE_SUPABASE_ANON_KEY` en Supabase y Vercel env vars.
10. Vaciar arrays `INITIAL_*` si los datos son reales.
11. Reparar `handleVoidReceipt` para revertir `paid_amount` y `balance_amount`.
12. Escribir README real.

---

## Deuda técnica grande

- Migrar cálculos float a centavos enteros (helper Money). 16-24 h. Hacerlo antes de tener más datos.
- Refactor `PatientDetail.tsx` (3,388 líneas) en componentes y hooks. 24-40 h.
- Refactor `Financials.tsx` y `Payroll.tsx`. 24-40 h.
- Reescribir RLS de Supabase con matriz de permisos por rol. 16-24 h.
- Convertir operaciones críticas (cotización→factura, registrar cobro, generar planilla) a RPC/Edge Functions atómicas. 16-32 h.
- Tests automatizados de los flujos de facturación y planilla. 24-40 h iniciales.
- Reemplazar `useDB` masivo por CRUD granular. 16-40 h.

---

## Recomendaciones de orden (próximos 14 días)

- **Día 1:** rotar `VITE_SUPABASE_ANON_KEY`. Quitar botón "Hacerme Administrador" + RLS de protección. Eliminar segundo NewInvoiceWizard.
- **Día 2-3:** validar montos en cobro. Cambiar "Eliminar" por "Anular". Reparar `handleVoidReceipt` para revertir saldos.
- **Día 4-5:** reemplazar `Usuario Actual` hardcoded por usuario real. Sanitizar CSV. Auditar `INITIAL_*` arrays.
- **Día 6-8:** reescribir RLS, asegurar `/api/send-nurse-report` con JWT, convertir cobros y conversión de cotizaciones a RPC.
- **Día 9-12:** helper Money con centavos enteros, migrar Financials y Payroll, verificar saldos existentes.
- **Día 13-14:** Edge Function para marcar facturas vencidas. README real. Empezar tests del flujo de facturación.

---

## Métricas

- Total de archivos `.tsx` analizados: ~32 (los más grandes y críticos)
- Líneas en src/ (sin CSS): ~17,059
- Tamaño del proyecto (sin node_modules/dist): ~520 KB de código fuente
- Hallazgos críticos: 7
- Hallazgos importantes: 14
- Mejoras: 12
- Quick wins identificados: 12

---

## Lo que NO pude evaluar

- Estado real de la BD en Supabase: si ya hay facturas con números colisionados, cuántos usuarios tienen rol admin, registros con `balance_amount` negativo, conteo real de turnos/facturas.
- Logs de acceso en Supabase para verificar si la `anon_key` ya fue abusada.
- Si los datos hardcoded de `INITIAL_NURSES/PATIENTS/CLIENTS` son personas reales o ficticias.
- Si el endpoint `/api/send-nurse-report` ya fue abusado (depende de logs Vercel/Resend).
- Comportamiento real del print con red, fuentes Google y imágenes en producción.
- Si los PDFs de factura cumplen requisitos legales de Hacienda El Salvador (sello, firma, formato).
- Performance con volumen real (`useDB` masivo se degradará pero no se midió).
- Browser compatibility (no se ejecutó la app).
- Inspección completa de qué más hay compilado en `dist/assets/index-*.js`.
- Si las tarifas hardcodeadas en `Payroll.tsx` y `initialData.ts` reflejan los precios reales del cliente.

---

**Nota final:** No se modificó ningún archivo del proyecto durante esta auditoría. Esta es una sesión de diagnóstico únicamente.
