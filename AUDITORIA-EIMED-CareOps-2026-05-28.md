# AUDITORÍA TÉCNICA — EIMED CareOps — 2026-05-28

**Auditor:** Agente Auditor (Claude Code)
**Alcance:** Solo lectura, sin modificaciones
**Directorio auditado:** `G:\Aplicaciones\App Eimed`
**Foco especial:** Experiencia de uso móvil web (responsive design, viewports, touch, navegación desde teléfono)

---

## 1. Resumen Ejecutivo

EIMED CareOps es una aplicación web de gestión clínica y financiera (turnos, pacientes, enfermeras, facturación, planilla). El stack es moderno (React 19 + TypeScript + Vite + Supabase) y el código es limpio en estructura. Hay tres problemas que requieren atención antes de producción confiable:

1. La aritmética financiera usa float de JavaScript para manejar dinero, produciendo errores de redondeo acumulativos en totales de planilla y facturas.
2. Las vistas más usadas son monolitos gigantes: Financials.tsx (1476 líneas), Payroll.tsx (1978 líneas), PatientDetail.tsx (3388 líneas).
3. Las tablas de facturas y planillas carecen de wrapper `overflow-x: auto`, haciendo el módulo financiero prácticamente inusable desde teléfono móvil.

En cuanto a mobile, hay trabajo serio hecho: sidebar con drawer, media queries en 19 archivos CSS, tabs con scroll horizontal. Pero existen gaps en Settings, en las tablas de Financials/Payroll, y en los botones de acción del TopBar que desaparecen a 480px sin alternativa accesible. El sistema es funcional y tiene buenas bases; los problemas son manejables con prioridad clara.

---

## 2. Stack Detectado

| Componente | Tecnología |
|---|---|
| Lenguaje principal | TypeScript 5.9 |
| Framework UI | React 19 |
| Bundler | Vite 8 |
| Routing | React Router DOM 7 |
| Backend / Auth | Supabase (PostgreSQL + Auth + Realtime) |
| Almacenamiento offline | localStorage (cache + modo sin conexión) |
| Estilos | CSS por componente (sin Tailwind, sin framework CSS) |
| PDF / Exportación | jsPDF, html2canvas, JSZip, xlsx |
| Email API | Resend (serverless en `/api/send-nurse-report.js`) |
| Deploy | Vercel (`vercel.json` con rewrites SPA) |
| Otras librerías | date-fns, lodash, lucide-react |

---

## 3. Estructura del Proyecto

```
App Eimed/
├── api/                     ← Serverless functions (Vercel)
│   ├── ping.js              ← Health check con cron cada 5 días
│   └── send-nurse-report.js ← Envío de PDF por email
├── src/
│   ├── components/layout/   ← Sidebar, TopBar
│   ├── components/ui/       ← Modal, SearchableCombobox
│   ├── components/patient/  ← 7 sub-componentes del detalle de paciente
│   ├── components/*Print.tsx ← Componentes de impresión PDF
│   ├── contexts/            ← AuthContext (Supabase)
│   ├── hooks/               ← useDB.ts (Supabase + localStorage)
│   ├── lib/                 ← supabase.ts (cliente)
│   ├── services/            ← db.ts (capa localStorage heredada, parcialmente activa)
│   ├── types/               ← index.ts (~400 líneas de tipos)
│   ├── utils/               ← PDF, Excel, numberToWords
│   └── views/               ← 13 vistas principales
├── supabase_schema.sql      ← DDL completo bien comentado
└── MIGRATION_GUIDE.md
```

**Observaciones:**
- La separación entre `services/db.ts` (patrón clase) y `hooks/useDB.ts` (hook React) crea duplicación de responsabilidad. `db.ts` existe pero ya no es el path principal.
- `PatientDetail.tsx` (3388 líneas), `Payroll.tsx` (1978 líneas) y `Financials.tsx` (1476 líneas) deberían dividirse en subvistas.
- Los archivos `.sql` en la raíz deberían estar en `supabase/migrations/`.

---

## 4. Hallazgos por Área

### 4.1 Responsive / Mobile Web

Estado general: El trabajo de responsive es serio. Hay 50 media queries en 19 archivos CSS con breakpoints consistentes (768px y 640px). El sidebar tiene drawer + backdrop + hamburger correctamente implementados. Las tabs usan scroll horizontal. Existen brechas específicas críticas.

**[CRITICO-MOB-1] Tablas de facturas/planillas sin table-wrapper en Financials y Payroll**

`index.css` define `table { min-width: 580px; }` y la clase `.table-wrapper` con `overflow-x: auto` existe, pero en el JSX de `Financials.tsx` y `Payroll.tsx` las tablas se renderizan directamente sin ese wrapper. En un iPhone (375px), la tabla empuja el layout y rompe el scroll vertical de toda la página. El módulo financiero más crítico es prácticamente inusable desde móvil.

**[MEDIO-MOB-2] TopBar pierde la búsqueda global en pantallas < 480px sin alternativa**

`TopBar.css`: `@media (max-width: 480px) { .top-bar-search { display: none; } }`. La búsqueda desaparece sin botón de lupa ni alternativa contextual.

**[MEDIO-MOB-3] Settings.css sin breakpoints para < 768px**

Solo existe un media query en 1024px. La vista usa `height: calc(100vh - 160px)` con sidebar interno de 300px. En tablet vertical, el área de contenido puede quedar con menos de 200px de ancho, haciendo ilegibles los formularios de tipos de turno, correlativas y datos de empresa.

**[MENOR-MOB-4] Touch targets insuficientes en botones de fila**

`.sale-remove-btn` (26x26px) e `.icon-btn` (28x28px) están por debajo del mínimo recomendado de 44px.

**[MENOR-MOB-5] Panel de filtros de Financials sin overflow en tablets 1024px-1200px**

`.fin-filter-panel` usa `grid-template-columns: repeat(4, 1fr)` y los breakpoints solo inician en 1200px.

**[MENOR-MOB-6] Sidebar de filtros del calendario oculto en mobile sin sustituto**

`Calendar.css`: `.calendar-sidebar { display: none; }` en 768px. Los filtros por paciente/enfermera no tienen alternativa en mobile.

**Lo que funciona bien:** sidebar drawer + backdrop correctamente implementado; `.tabs-premium` con scroll horizontal; calendario mes en 640px con `minmax(0, 1fr)` y scroll vertical; grids de stats con `auto-fit`; modales al 95vw en 768px; login responsive.

---

### 4.2 Seguridad

**[CRITICO-SEC-1] Archivo `.env` con credenciales reales en el directorio de trabajo**

`G:\Aplicaciones\App Eimed\.env` contiene la URL del proyecto Supabase y la clave `anon` en texto plano. `.gitignore` excluye el archivo. Sin embargo, si el proyecto se comparte por ZIP, USB o Google Drive, las credenciales van incluidas.

**[MEDIO-SEC-2] Modo local sin autenticación asigna rol admin**

`AuthContext.tsx` lineas 50-55: cuando Supabase no está configurado, el sistema asigna `role: 'admin'` automáticamente sin credenciales. En un deploy de staging sin Supabase configurado, cualquier visitante tiene acceso admin completo.

**[MEDIO-SEC-3] Autorización por rol solo en UI, sin guarda de rutas**

`isAdmin` solo se usa en `Settings.tsx` para mostrar/ocultar elementos. No hay una guarda de ruta que impida a un usuario `operativo` navegar a `/settings`.

**[BAJO-SEC-4] API endpoint de email sin autenticación**

`api/send-nurse-report.js` acepta cualquier POST sin verificar que el llamante sea usuario autenticado. Permite abuso del servicio Resend.

**Lo que está bien:** no hay credenciales hardcodeadas en código fuente; RLS habilitado en todas las tablas; `is_admin()` con `security definer`; GRANTs explícitos.

---

### 4.3 Lógica de Negocio

**[CRITICO-NEG-1] Aritmética financiera con float de JavaScript**

Todos los cálculos de dinero usan `number` (IEEE 754). Ejemplos en `Financials.tsx`:
```js
const newPaid = inv.paid_amount + amount;
const newBalance = inv.total_amount - newPaid;
```
El patrón `.toFixed(2)` se usa solo para visualización, no para cálculos intermedios. Múltiples pagos parciales pueden acumular errores de punto flotante.

**[MEDIO-NEG-2] Numeración de documentos con race condition**

`getAndIncrementCorrelative` en `Financials.tsx` realiza lectura-incremento-escritura no atómica en el cliente. Con 2+ usuarios simultáneos pueden generarse números de factura duplicados. Las facturas correlativas son requisito legal del Ministerio de Hacienda en El Salvador.

**[MEDIO-NEG-3] Eliminación física de facturas permitida**

`handleDeleteInvoice` elimina facturas permanentemente. Para documentos fiscales solo debería permitirse anulación (`void`). No hay log de auditoría de quién eliminó qué.

**[MEDIO-NEG-4] IDs generados con Date.now() y Math.random()**

`Financials.tsx` usa `` `REC-${Date.now()}` `` y `Math.random().toString()`. El estándar es `crypto.randomUUID()`.

**[MENOR-NEG-5] KPIs del Dashboard sin filtro por período**

Los totales de facturación suman toda la historia sin acotar por mes.

**Lo que está bien:** integridad referencial antes de eliminar entidades; máquina de estados coherente para facturas; conversión cotización-factura preserva ítems; anulaciones marcan `status: void` sin borrar.

---

### 4.4 Base de Datos

**[CRITICO-BD-1] Esquema todo en JSONB sin columnas indexadas**

Todas las tablas usan `{ id text, data jsonb }`. Los campos de negocio (fecha, estado, client_id) están dentro del JSONB. No hay índices sobre campos de filtro. Con miles de turnos/facturas, cada carga será lenta porque el filtrado ocurre en JavaScript del cliente, no en el servidor.

**[MEDIO-BD-2] Cotizaciones no están en TABLE_MAP de useDB.ts**

La tabla `quotations` existe en Supabase pero la clave `'quotations'` no tiene entrada en `TABLE_MAP`. El fallback funciona por coincidencia de nombre pero puede romperse.

**[MEDIO-BD-3] Discrepancia de claves para recibos de ingreso**

`useDB.ts` mapea `receipts -> income_receipts`, pero `Financials.tsx` usa `'income_receipts'` directamente. Doble entrada que puede causar confusión.

**Lo que está bien:** RLS en todas las tablas; trigger `set_updated_at`; GRANTs explícitos; trigger `handle_new_user`.

---

### 4.5 Dependencias

| Paquete | Versión | Observación |
|---|---|---|
| `xlsx` | `^0.18.5` | Sin actualizaciones de seguridad desde 2023. CVEs en versiones antiguas. |
| `html2canvas` | `^1.4.1` | Sin actualizaciones desde 2022. Problemas conocidos con SVG y CORS. |
| `react` | `^19.2.4` | React 19 muy reciente (dic 2024). Monitorear comportamientos de hooks. |
| `vite` | `^8.0.0` | Vite 8 muy reciente. |
| `jspdf` | `^4.2.1` | Versión actual, sin problemas conocidos. |

Sin dependencias abandonadas críticas.

---

### 4.6 Documentación

**[CRITICO-DOC-1] README.md es el template de Vite, sin documentación del sistema**

`README.md` es el README por defecto de `create-vite`. No contiene descripción del sistema, cómo levantarlo, variables de entorno, arquitectura ni guía de deployment.

**Lo que sí está documentado:** `MIGRATION_GUIDE.md` (guía detallada), `supabase_schema.sql` (DDL bien comentado), `.env.example` (lista variables necesarias), comentarios abundantes en el código.

---

## 5. Hallazgos Críticos (Top 5)

### CRITICO-1: Aritmética financiera con float de JavaScript
- **Qué:** Todos los cálculos de dinero usan `number` IEEE 754. `newBalance = total_amount - newPaid` puede producir saldos como `$999.9999999999999`.
- **Dónde:** `src/views/Financials.tsx`, `src/views/Payroll.tsx` múltiples líneas.
- **Impacto:** Errores de centavos acumulativos, documentos con saldos incorrectos, posible problema legal con Hacienda.
- **Esfuerzo estimado:** 8-12 horas (implementar `toMoney(n) = Math.round(n * 100) / 100` y aplicar en todos los cálculos).

### CRITICO-2: Tablas de Financials/Payroll sin wrapper de overflow en mobile
- **Qué:** La clase `.table-wrapper` existe en `index.css` pero no se usa en el JSX. En iPhone/Android el módulo de cobros y planilla es inusable.
- **Dónde:** `src/views/Financials.tsx`, `src/views/Payroll.tsx`.
- **Impacto:** El módulo financiero más crítico es inusable desde teléfono.
- **Esfuerzo estimado:** 2 horas — máximo impacto por mínimo esfuerzo.

### CRITICO-3: Race condition en numeración de facturas con múltiples usuarios
- **Qué:** `getAndIncrementCorrelative` realiza lectura-incremento-escritura no atómica en el cliente. Con 2+ usuarios simultáneos pueden generarse números de factura duplicados.
- **Dónde:** `src/views/Financials.tsx` función `getAndIncrementCorrelative`.
- **Impacto:** Dos facturas con el mismo número. Las facturas correlativas son requisito legal del Ministerio de Hacienda en El Salvador.
- **Esfuerzo estimado:** 6-10 horas (mover generación a función PostgreSQL con `FOR UPDATE` o secuencia nativa).

### CRITICO-4: README sin documentación del proyecto
- **Qué:** `README.md` es el template de `create-vite`. Sin instrucciones de instalación, configuración ni deployment.
- **Dónde:** `/README.md`
- **Impacto:** En emergencia de producción, levantar el sistema puede tomar horas innecesarias.
- **Esfuerzo estimado:** 2-3 horas.

### CRITICO-5: Modo sin Supabase asigna rol admin sin autenticación
- **Qué:** Si `VITE_SUPABASE_URL` está vacío o apunta a placeholder, `AuthContext` asigna `role: 'admin'` sin credenciales.
- **Dónde:** `src/contexts/AuthContext.tsx` líneas 50-55.
- **Impacto:** En deploy de staging sin Supabase configurado, la app está completamente abierta en modo admin.
- **Esfuerzo estimado:** 1 hora.

---

## 6. Hallazgos Medios

| # | Descripción | Dónde | Esfuerzo |
|---|---|---|---|
| MEDIO-1 | IDs con `Date.now()` y `Math.random()` en lugar de `crypto.randomUUID()` | `Financials.tsx` | 1 hora |
| MEDIO-2 | Eliminación física de facturas disponible (debería ser solo void) | `Financials.tsx` | 2 horas |
| MEDIO-3 | API de email sin autenticación — abuso potencial de Resend | `api/send-nurse-report.js` | 2 horas |
| MEDIO-4 | `Settings.css` sin media query para < 768px | `src/views/Settings.css` | 2 horas |
| MEDIO-5 | Schema JSONB sin índices sobre campos de búsqueda frecuentes | `supabase_schema.sql` | 3-4 horas |
| MEDIO-6 | `services/db.ts` y `hooks/useDB.ts` con responsabilidades duplicadas | `src/services/db.ts` | 4 horas |
| MEDIO-7 | Filtros del calendario ocultos en mobile con `display: none` sin alternativa | `src/views/Calendar.css` | 4 horas |

---

## 7. Quick Wins (menos de 2 horas cada uno)

| # | Descripción | Esfuerzo | Impacto |
|---|---|---|---|
| QW-1 | Envolver tablas en `<div className="table-wrapper">` en Financials y Payroll | 2 horas | MUY ALTO en mobile |
| QW-2 | Reemplazar `Date.now()` con `crypto.randomUUID()` en IDs | 30 min | Medio |
| QW-3 | Agregar breakpoints 768px y 640px en `Settings.css` | 1 hora | Alto en mobile |
| QW-4 | Crear `utils/money.ts` con `toMoney(n)` y aplicar en cálculos de dinero | 4 horas | Muy alto |
| QW-5 | Escribir `README.md` real con instrucciones de setup | 2-3 horas | Alto (mantenimiento) |
| QW-6 | Agregar `touch-action: manipulation` a `button` en `index.css` | 30 min | Medio iOS |
| QW-7 | Aumentar `.sale-remove-btn` (26px) e `.icon-btn` (28px) a 44px mínimo | 1 hora | Medio mobile |
| QW-8 | Mover archivos `.sql` a carpeta `supabase/` | 15 min | Organización |

---

## 8. Recomendaciones Prioritarias

### Días 1-3: Mobile con mayor impacto inmediato
1. Envolver tablas de Financials y Payroll en `div.table-wrapper` — desbloquea el módulo financiero desde móvil.
2. Aumentar touch targets a 44px en botones de fila.
3. Agregar `touch-action: manipulation` a botones.
4. Agregar breakpoints mobile a `Settings.css` (768px y 640px).

### Días 4-7: Seguridad y confiabilidad
5. Implementar `toMoney(n)` y aplicar en todos los cálculos de dinero (antes de que el volumen de facturas crezca).
6. Reemplazar `Date.now()` con `crypto.randomUUID()` en generación de IDs.
7. Bloquear el modo local-sin-Supabase en producción con variable de entorno.
8. Restringir eliminación de facturas solo a estado `draft`.

### Semana 2: Calidad y documentación
9. Escribir `README.md` real con instrucciones de setup y deployment.
10. Mover lógica de numeración correlativa a función PostgreSQL atómica.
11. Agregar drawer de filtros para el calendario en mobile.
12. Agregar índices de expresión en Supabase para campos más consultados.

### Deuda técnica a mediano plazo (1-2 meses)
- Refactorizar `PatientDetail.tsx` (3388 líneas).
- Decidir si `services/db.ts` sigue activo o se elimina en favor de `hooks/useDB.ts`.
- Agregar verificación de JWT al endpoint `/api/send-nurse-report`.

---

## 9. Métricas

| Métrica | Valor |
|---|---|
| Archivos analizados | ~55 (TSX, CSS, TS, SQL, JS) |
| Líneas de código (src/) | ~18,000 líneas estimadas |
| Líneas de CSS | ~6,500 líneas |
| Media queries definidas | 50 instancias en 19 archivos CSS |
| Breakpoints usados | 480px, 640px, 768px, 1024px, 1200px, 1280px |
| Hallazgos críticos | 5 |
| Hallazgos medios | 7 |
| Quick Wins identificados | 8 |

---

## 10. Lo que NO se pudo evaluar

1. Comportamiento real en dispositivo físico (iOS Safari, Chrome Android).
2. Performance con datos reales (500+ turnos, 200+ facturas en Supabase).
3. Políticas RLS bajo prueba de penetración activa.
4. Compatibilidad con iOS Safari 16/17 para `backdrop-filter` y el selector `:has()`.
5. Límites de localStorage en producción — el `catch` en `useDB.ts` falla silenciosamente.
6. Estado real de la sincronización Supabase para cotizaciones y recibos con las discrepancias de claves encontradas.
