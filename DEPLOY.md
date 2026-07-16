# DEPLOY — feature/auditoria-planillas

Fecha: 2026-07-15 (noche)
Preparado y ejecutado por: orquestador Claude Code, con autorización explícita del usuario
("al terminar el deploy puedes apagar la pc").

---

## 1. Qué se despliega

Rama `feature/auditoria-planillas` → `main` → Vercel (deploy automático al hacer push a main).

Feature completo de **auditoría y control de planillas** (PRD: `Cambios solicitados/PLAN-PLANILLAS-15072026.md`,
historias H1–H20 en `STORIES.md`):

- **Bugs corregidos:** anular planilla libera sus turnos (con guarda anti doble-liberación);
  aprobar/pagar/anular con feedback en vivo + toasts; feedback en agenda.
- **Conciliación automática:** banner de turnos realizados sin planilla, estado de período
  INCOMPLETO, turnos vencidos con resolución directa, aviso al marcar realizado tarde,
  detector de doble pago, confirmación dura en "Forzar reprocesamiento".
- **Detalle de planilla:** fecha/paciente/tipo/tarifa por turno + resumen por paciente.
- **Retroactivo:** navegación a períodos viejos sin planillas.
- **Validaciones OBSERVADO (no bloquean):** rango histórico (≥3 pagos), topes 24h
  (proyección ×24 y suma del día), montos $0, >24h o traslape por enfermera (crítico),
  pago>cobro, ajustes filtrados por período. Confirmación extra al aprobar con observaciones.
- **Tarifas:** eliminados los fallbacks fijos 50/60/110; ahora paciente → catálogo → 0+observado.
  `pay_amount > 0` guardado en el turno SIEMPRE se respeta (montos existentes no cambian).
- **Infra de calidad nueva:** Toast global; `src/utils/payrollAudit.ts` (lógica pura) con
  71 tests (vitest, `npm test`) — primera suite del proyecto.

## 2. Verificaciones ejecutadas antes del merge

- `npm run build` (tsc -b + vite) — PASA.
- `npm test` — 71/71 tests PASAN.
- `npm run lint` — 232 errores / 8 warnings, idéntico a la línea base pre-feature (cero nuevos).
- GATE QA: APROBADO (`QA-REPORT.md`) — hallazgos H3/H6 corregidos y re-verificados.
- GATE REVISIÓN: APROBADO CON OBSERVACIONES, 0 bloqueantes (`REVIEW-REPORT.md`) — hallazgos
  medios #1 (guarda anti doble-liberación) y #3 (redondeo bruto) APLICADOS; #2 (rendimiento
  de validación con muchos miles de turnos) y #4 (tarifa de paciente en cero no cae a catálogo)
  quedan documentados como deuda aceptada.
- Sin cambios en Supabase (ni esquema, ni RLS, ni datos): el feature es 100% frontend/lógica.
- `.env` fuera del repo (verificado en .gitignore y git status).

## 3. Plan de reversión

Si algo sale mal en producción:

```
git revert -m 1 <merge_commit>   # revierte el merge en main
git push                          # Vercel redespliega la versión anterior
```

Alternativa inmediata sin git: en el dashboard de Vercel (proyecto app-eimed) →
Deployments → "Promote to Production" sobre el deployment anterior.

No hay migraciones de datos que revertir: el feature no escribe campos nuevos obligatorios
ni altera datos existentes por sí solo.

## 4. Post-deploy (pendiente para el usuario, en la app)

1. Ir a Planillas → período 01–15 JUL 2026: verá el banner de conciliación con los turnos
   realizados sin pagar y el estado INCOMPLETO.
2. Pulsar "Procesar ahora" para generar las planillas complementarias (NO activar
   "Forzar reprocesamiento").
3. Revisar planillas con chip OBSERVADO antes de aprobar/pagar.
4. Resolver los turnos vencidos que aparezcan en el banner naranja.
