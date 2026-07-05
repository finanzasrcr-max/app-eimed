# Auditoría: EIMED CareOps
**Fecha:** 2026-07-05
**Auditor:** Agente Auditor
**Alcance:** Solo lectura, sin modificaciones
**Directorio:** `G:\Aplicaciones\App Eimed`
**Enfoque prioritario solicitado:** (1) Estabilidad — pantallas/modales que se cierran solos, (2) UX de edición de pacientes, (3) Web móvil.

---

## Resumen ejecutivo

El sistema mejoró de forma medible desde la auditoría de mayo: se aplicó `toMoney()` a los cálculos de dinero, se agregaron los table-wrappers en Financials/Payroll, los touch targets ya son de 44px, Settings tiene breakpoints móviles, el calendario tiene filtro móvil y el README es real. Sin embargo, **el problema de "la pantalla se cierra sola" tiene causas concretas y reproducibles en el código**: todos los modales se cierran con un clic/tap fuera (incluso al arrastrar el cursor mientras se selecciona texto en un input), no existe ningún Error Boundary (un solo registro malformado pone la app en pantalla blanca), y la capa de sincronización con Supabase (`useDB`) puede pisar ediciones en curso o vaciar la caché local si la sesión expira. La edición de pacientes está fragmentada en 6+ formularios con campos huérfanos (alergias solo se pueden capturar en el alta; estado civil y GPS se muestran pero no se pueden editar en ningún lado) y hay una inconsistencia de datos entre "Responsables" y "Clientes". Es urgente intervenir en estabilidad (días); el resto es planificable en 2-4 semanas.

---

## Stack detectado

- **Lenguaje principal:** TypeScript 5.9
- **Framework:** React 19 + Vite 8, React Router DOM 7 (SPA, sin backend propio)
- **Base de datos (inferida):** Supabase/PostgreSQL — esquema `{id, data jsonb}` por tabla, con caché espejo en `localStorage`
- **Auth:** Supabase Auth (roles admin/operativo en tabla `profiles`)
- **Otros componentes:** jsPDF 4, html2canvas, xlsx, jszip, date-fns 4, lucide-react; API serverless en Vercel (`api/send-nurse-report.js` con Resend); CSS propio por componente
- **Nota:** `lodash` está en `package.json` pero no se importa en ningún archivo de `src/` (dependencia muerta)

---

## SECCIÓN PRIORITARIA 1 — ESTABILIDAD: por qué "se cierra la pantalla sola"

Se revisaron todas las vistas y los ~30 modales del sistema. Hay **cuatro mecanismos independientes** que producen exactamente el síntoma reportado (estar editando una enfermera/paciente y que el modal o la pantalla desaparezcan). En orden de probabilidad:

### E1. El overlay del modal cierra con cualquier clic — incluye arrastres de selección de texto (CAUSA MÁS PROBABLE)
- **Dónde:** `src/components/ui/Modal.tsx` línea 28: `<div className="modal-overlay ..." onClick={onClose}>`.
- **Qué pasa:** Si el usuario hace `mousedown` dentro de un input (por ejemplo, para seleccionar/corregir texto del nombre de la enfermera) y suelta el mouse fuera del modal, el evento `click` se dispara en el overlay y el modal se cierra, **perdiendo todo lo escrito, sin confirmación**. En móvil, cualquier tap accidental en el borde oscuro hace lo mismo. Afecta a los ~30 modales del sistema (Nurses, PatientDetail x11, Calendar, Payroll x3, Financials, Catalog, Clients, Settings...). El drawer de turno del calendario (`shift-drawer-overlay`, `Calendar.tsx` línea 711) tiene el mismo patrón.
- **Impacto:** Pérdida diaria de trabajo del usuario; reproduce exactamente el reporte "estaba editando una enfermera y se cerró".
- **Corrección típica:** cerrar solo si `mousedown` Y `mouseup` ocurren sobre el overlay, y/o pedir confirmación si el formulario tiene cambios sin guardar.
- **Esfuerzo:** 2-3 horas (es un solo componente compartido).

### E2. Cero Error Boundaries + accesos sin protección = pantalla blanca total
- **Dónde:** No existe ningún `ErrorBoundary` en `src/` (verificado por búsqueda). `main.tsx` renderiza `<App/>` sin protección.
- **Detonantes reales encontrados:**
  - `src/views/Nurses.tsx:80` — `nurses.map(n => n.bank_info.bank)` sin optional chaining. Una enfermera sin `bank_info` (p. ej. importada por CSV desde otro dispositivo, o registro viejo) lanza `TypeError` y **desmonta toda la aplicación**.
  - `src/views/NurseDetail.tsx:362` — `nurse.bank_info.type.toUpperCase()`.
  - `src/views/Nurses.tsx:578` — `format(parseISO(nurse.next_shift))` lanza `RangeError` si `next_shift` es una fecha inválida.
  - Patrón repetido con `parseISO` sin guarda en Calendar (26 usos), PatientDetail (17), Payroll (14).
- **Por qué se manifiesta "solo":** la suscripción realtime de `useDB` refresca datos en segundo plano; si otro dispositivo sincroniza un registro malformado, el re-render revienta **mientras el usuario está editando** y la app queda en blanco.
- **Esfuerzo:** 4-6 horas (ErrorBoundary global + por vista, y optional chaining en los puntos listados).

### E3. `useDB` puede pisar la edición en curso o vaciar los datos
- **Dónde:** `src/hooks/useDB.ts`.
- **Problemas concretos:**
  1. **Eco de escrituras propias:** `setValue` (líneas 137-178) hace upsert de **todo el array** (una fila por registro). Cada fila genera un evento realtime que dispara `fetchFromSupabase()`: guardar 1 enfermera con 50 en la tabla produce ~50 eventos y múltiples refetch completos.
  2. **Carrera refetch vs. escritura:** el guardado es optimista; si un refetch (por eco o por otro usuario) termina **antes** de que el upsert propio aterrice, `setDataState(items)` repone los datos viejos y la edición "desaparece" de la pantalla.
  3. **Last-write-wins de tabla completa:** dos usuarios editando enfermeras distintas se sobreescriben mutuamente, porque cada guardado escribe TODAS las filas desde su estado local (posiblemente desactualizado). Esto ya causó el incidente documentado en `supabase_open_writes.sql` ("cambios rechazados en silencio... cada dispositivo ve algo distinto").
  4. **Vaciado de caché al expirar la sesión:** si el refresh del token falla, los SELECT como `anon` con RLS devuelven `[]` **sin error**; `useDB` (líneas 99-109) guarda `[]` en el estado y **sobreescribe la caché de localStorage con vacío**. En `PatientDetail.tsx:85-97`, `patients.find()` deja de encontrar al paciente y la vista completa se reemplaza por "Paciente no encontrado", desmontando cualquier modal abierto. Síntoma idéntico al reportado.
- **Esfuerzo:** 8-16 horas (guardar solo filas modificadas, ignorar ecos propios, no persistir resultados vacíos sin verificar sesión, pausar refetch con modal de edición abierto).

### E4. Expiración de sesión redirige a /login desmontando todo
- **Dónde:** `src/App.tsx:44-49` (`<Navigate to="/login">` cuando `user` es null) + `src/contexts/AuthContext.tsx:68-75` (`onAuthStateChange`).
- **Qué pasa:** si Supabase emite `SIGNED_OUT` (refresh token inválido; típico al volver de suspensión del equipo o con el navegador móvil en segundo plano), la app navega a /login **en medio de la edición**, sin guardar ni avisar.
- **Esfuerzo:** 3-4 horas (interceptar el evento y pedir re-login en un modal sin desmontar la vista).

**Notas adicionales de estabilidad:** los IDs se generan con `Math.random().toString(36).substr(2,9)` en pacientes, turnos, catálogo e historial (riesgo bajo de colisión, pero es la clave primaria en Supabase); `QuickAddPatientModal` nunca resetea su estado al cerrar (ver sección 2); los `try/catch` de useDB solo hacen `console.error` — el usuario nunca se entera de que su guardado falló, lo cual agrava E3. No se detectaron `catch` vacíos ni promesas obviamente sin manejo.

---

## SECCIÓN PRIORITARIA 2 — UX DE PACIENTES: mapa completo del flujo de edición

### Dónde se edita cada cosa hoy

| # | Pantalla / Modal | Campos que edita | Observaciones |
|---|---|---|---|
| 1 | **Alta Rápida** (`QuickAddPatientModal`, desde vista Pacientes) | Nombre, fecha nac., sexo, código (auto), dirección, referencia, municipio, depto., tipo ubicación, cliente principal + relación, tipo servicio inicial, turno inicial, fecha inicio, estado, **alergias**, observación inicial | Único lugar donde se capturan alergias. **La "observación inicial" se recolecta pero nunca se guarda** (no está en el objeto `newPatient`, `QuickAddPatientModal.tsx:41-69`). El código `PAC-XXXX` se genera **una sola vez por sesión** (`useState(generateCode())`, línea 34): todos los pacientes creados sin recargar la página reciben **el mismo código**. El formulario no se resetea al cerrar. |
| 2 | **"Editar Datos Generales"** (`PatientEditForm`, modal en PatientDetail; se abre desde el tab Datos, el header y los accesos rápidos) | Nombre, alias, fecha nac., sexo, DUI, NIT, nacionalidad, dirección, referencia, tipo ubicación, municipio, departamento | **No** incluye: alergias, estado civil, GPS, cliente principal, servicio/turno inicial. |
| 3 | **"Modificar Información de Cuidado"** (`CareInfoForm`, tab Cuidado) | Diagnóstico, dependencia, movilidad, riesgos (tags), oxígeno, monitoreo, indicaciones, médico tratante + teléfono, condiciones, medicamentos | **No** incluye alergias, aunque sería el lugar natural. |
| 4 | **"Configuración de Servicio Activo"** (`ActiveServiceForm`, tab Servicios) | Modalidad, tarifa diaria, turno habitual, horario, días de servicio, matriz de tarifas por tipo de turno, reemplazo automático, perfil especial, observaciones, **fecha de inicio del servicio** | La fecha de inicio también se fija en el Alta (nº1) y se muestra en el tab Datos: tres lugares para el mismo dato. |
| 5 | **Responsables** (`ResponsableForm`, tab Responsables) | Lista embebida `patient.responsables`: nombre, tipo, relación, teléfono, email, dirección de facturación, NIT, es-principal, autorizaciones | **Inconsistencia grave:** al marcar un responsable como principal, `PatientDetail.tsx:212` asigna `primary_client_id = responsable.id` — un ID aleatorio de la sublista que **no existe en la tabla `clients`**. A partir de ahí la facturación y las vistas muestran "Particular"/"Sin asignar" porque `clients.find()` no lo encuentra. Responsables (embebidos) y Clientes (tabla global) son dos catálogos paralelos sin sincronización. |
| 6 | **Contactos de emergencia** (`EmergencyContactForm`, tab Emergencia) | Lista embebida de contactos | Separado de Responsables, aunque conceptualmente se solapan. |
| 7 | **Cambio de estado** (`handleStatusChange`, header de PatientDetail) | status (activo, inactivo, hospitalizado, etc.) | Fuera de cualquier formulario. |
| 8 | **Vista Clientes / ClientDetail** | Datos del pagador (tabla `clients`) | El vínculo paciente-cliente solo se establece en el Alta; después no hay UI directa para cambiarlo salvo el mecanismo roto del punto 5. |

### Campos huérfanos (se muestran pero no se pueden editar en NINGÚN lugar)
- **`allergies`** — se muestra en 3 lugares (header de `PatientDetail.tsx:641`, `PatientSummaryTab.tsx:208`, `PatientCareTab.tsx:58`) pero solo se captura en el Alta Rápida. Si el paciente se creó sin alergias, ya no hay forma de registrarlas. Para cuidados domiciliarios esto es un riesgo clínico, no solo de UX.
- **`civil_status`** y **`gps`** — se muestran en `PatientDatosTab.tsx` (líneas 56 y 78) como "No registrado" y no existe ningún formulario que los edite.
- **`initial_service_type` / `initial_shift_type`** — solo en el Alta; se muestran en el tab Datos sin poder corregirse.

### Diagnóstico de fragmentación
`PatientDetail.tsx` tiene **12 tabs** y **11 modales** en un archivo de 3,393 líneas. Para completar el expediente de un paciente nuevo hay que pasar por al menos 4 modales distintos (Datos, Cuidado, Servicio, Responsables), cada uno accesible desde lugares diferentes (botón del header, botón dentro del tab, accesos rápidos del Resumen), lo que explica la confusión de "dónde se configura cada cosa". No hay wizard ni indicador de completitud del expediente.

**Recomendación:** unificar en un formulario de expediente único con secciones (o wizard de 4 pasos), mover alergias a la Ficha Clínica (editable), agregar estado civil y GPS al formulario de datos generales, guardar la observación inicial, y eliminar la dualidad Responsables/Clientes (o sincronizarla con la tabla `clients`, arreglando el bug de `primary_client_id`).

---

## SECCIÓN PRIORITARIA 3 — WEB MÓVIL

### Lo que ya está bien (mejoras verificadas desde la auditoría de mayo)
- `viewport` meta correcto en `index.html`.
- Sidebar drawer + hamburger; la búsqueda del TopBar ahora tiene toggle en <480px (`top-bar-search-toggle`).
- `table-wrapper` con `overflow-x: auto` aplicado en **Financials (6 tablas) y Payroll (6 tablas)**.
- Touch targets: `.icon-btn` ahora tiene `min-width/height: 44px`; `touch-action: manipulation` en `index.css`.
- `Settings.css` ya tiene breakpoints 1024/768/640.
- Calendario: botón de filtros móvil (`cal-mobile-filter-wrap`, `Calendar.tsx:508` + panel en línea 1012) sustituye al sidebar oculto.
- 46 media queries en 16 archivos CSS con breakpoints consistentes.

### Problemas vigentes

**[MOB-1] Tablas de Pacientes y Enfermeras SIN wrapper y con `overflow: hidden`**
`Patients.tsx:162` y `Nurses.tsx:517` renderizan `<table className="premium-table">` dentro de `<div className="card" style={{ padding: 0, overflow: 'hidden' }}>`. Con `table { min-width: 580px }` (`index.css:886`), en un teléfono de 375-414px **las columnas de la derecha (incluidos los botones Editar/Eliminar) quedan cortadas e inaccesibles**, sin scroll horizontal posible por el `overflow: hidden`. Es el mismo problema que ya se corrigió en Financials/Payroll, pendiente en las vistas de gestión. Esfuerzo: 1 hora.

**[MOB-2] Bundle de 2.0 MB (553 KB gzip) en un solo chunk, sin code-splitting**
`dist/assets/index-*.js` pesa 2,063 KB (553 KB gzip). No hay ningún `import()` dinámico en `src/`: jsPDF, html2canvas, xlsx y jszip se descargan y parsean al abrir la app, aunque solo se usan al exportar. En un teléfono de gama media con 4G son varios segundos de pantalla en blanco. Recomendación: `React.lazy` por vista + import dinámico de las librerías de exportación. Esfuerzo: 4-6 horas.

**[MOB-3] Grids con estilos inline no adaptables**
`Nurses.tsx:302` usa `style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}` inline para las stats cards — los media queries no pueden sobreescribir estilos inline, así que en 375px quedan 4 tarjetas comprimidas e ilegibles. Patrón repetido en headers de vistas (los botones "Importar CSV"/"Registrar Enfermera" en fila fija desbordan en <400px). Esfuerzo: 2-3 horas.

**[MOB-4] Cierre de modales por tap accidental** — ver E1; en móvil es mucho más frecuente. El drawer del calendario y todos los modales cierran con un tap en el fondo oscuro.

**[MOB-5] Modales con doble scroll y teclado en iOS** — el formulario de Nurses usa `maxHeight: calc(90vh - 130px)` con scroll interno; con el teclado abierto en iOS Safari el viewport se reduce y el botón "Guardar" puede quedar fuera de alcance. Probar en dispositivo real; considerar `dvh` en lugar de `vh`.

**[MOB-6] Fuentes de Google render-blocking** — `index.html` carga Inter+Outfit con `<link rel="stylesheet">` bloqueante; agrega latencia al primer render en móvil. Menor.

---

## Hallazgos por gravedad

### CRITICOS (rojo — atender en días)

**C1. Modales se cierran con clic/tap fuera perdiendo el trabajo (E1)**
- **Qué/Dónde:** `Modal.tsx:28` (`onClick={onClose}` en overlay); afecta ~30 modales + drawer del calendario.
- **Impacto:** pérdida diaria de datos escritos; reproduce el bug reportado por el usuario.
- **Esfuerzo:** 2-3 h.

**C2. Sin Error Boundary + crashes por datos malformados (E2)**
- **Qué/Dónde:** ningún ErrorBoundary en `src/`; `Nurses.tsx:80`, `NurseDetail.tsx:362`, `Nurses.tsx:578` y ~57 usos de `parseISO` sin guarda.
- **Impacto:** un registro corrupto (llegando en vivo por realtime) deja la app en pantalla blanca a todos los usuarios conectados.
- **Esfuerzo:** 4-6 h.

**C3. Sincronización useDB: sobrescritura entre usuarios y vaciado de caché (E3)**
- **Qué/Dónde:** `useDB.ts:137-178` (upsert de todo el array, last-write-wins) y `useDB.ts:99-109` (SELECT vacío por sesión expirada sobreescribe localStorage con `[]`).
- **Impacto:** pérdida real de datos multi-usuario (ya ocurrió: ver `supabase_open_writes.sql`); "desaparición" súbita de pacientes/enfermeras de la pantalla.
- **Esfuerzo:** 8-16 h.

**C4. Race condition en correlativos de facturas (persiste desde mayo)**
- **Qué/Dónde:** `Financials.tsx:71-77` — lectura-incremento-escritura en el cliente.
- **Impacto:** números de factura duplicados con 2+ usuarios simultáneos; las facturas correlativas son requisito legal (Hacienda, El Salvador).
- **Esfuerzo:** 6-10 h (función PostgreSQL atómica o secuencia nativa).

**C5. Sesión expirada desmonta la vista en medio de la edición (E4)**
- **Qué/Dónde:** `App.tsx:44-49` + `AuthContext.tsx:68-75`.
- **Impacto:** el usuario pierde lo que estaba escribiendo y aparece en /login "sin razón".
- **Esfuerzo:** 3-4 h.

### IMPORTANTES (amarillo — atender en 2-4 semanas)

| # | Qué | Dónde | Impacto | Esfuerzo |
|---|---|---|---|---|
| I1 | `primary_client_id` se corrompe al marcar un responsable como principal (apunta a un ID que no existe en `clients`) | `PatientDetail.tsx:212` | Facturación muestra "Sin asignar"; datos inconsistentes | 3-4 h |
| I2 | Código de paciente `PAC-XXXX` duplicado (se genera una vez por sesión) + formulario no se resetea + "observación inicial" se descarta | `QuickAddPatientModal.tsx:33-34, 41-69` | Expedientes con código repetido; datos perdidos | 2 h |
| I3 | Alergias solo capturables en el alta; estado civil y GPS no editables en ningún lugar | Ver sección prioritaria 2 | Riesgo clínico + confusión | 2-3 h |
| I4 | Columna "Próximo Turno" en Pacientes muestra datos FALSOS hardcodeados ("Mañana, 07:00 — Enfermera: María E.") | `Patients.tsx:236-239` | Información operativa engañosa para decisiones | 1-2 h |
| I5 | Historial de auditoría con usuario placeholder | `PatientDetail.tsx` (9 usos), `Patients.tsx`, `QuickAddPatientModal.tsx` | Sin trazabilidad real de quién creó/modificó/anuló | 2-3 h (usar `useAuth()`) |
| I6 | RLS abierta: cualquier autenticado escribe TODO (`supabase_open_writes.sql` aplicado); los roles admin/operativo solo se validan en UI | Supabase + `Settings.tsx` | Un usuario operativo puede modificar correlativos, tarifas o borrar registros vía consola del navegador | 4-6 h |
| I7 | API de email sin autenticación + interpolación de HTML sin escape (`nurseName`) | `api/send-nurse-report.js` | Abuso del servicio Resend; spam con remitente de la empresa | 2-3 h |
| I8 | Bundle 2 MB sin code-splitting (MOB-2) | imports estáticos en todo `src/` | Carga lenta en móvil | 4-6 h |
| I9 | Tablas de Pacientes/Enfermeras cortadas en móvil (MOB-1) | `Patients.tsx:162`, `Nurses.tsx:517` | Acciones inaccesibles desde teléfono | 1 h |
| I10 | IDs `Math.random()` como clave primaria en pacientes, turnos, catálogo, historial | 40+ ubicaciones | Riesgo de colisión: un upsert pisa un registro ajeno | 2 h |
| I11 | Export CSV sin escapar comillas dobles en los valores | `Financials.tsx:148` | CSV corrupto / inyección de fórmulas en Excel | 1 h |
| I12 | Cambios sin commitear en el repo (`Calendar.tsx`, `Payroll.tsx` modificados; archivos sueltos en raíz) | git status | Deriva entre lo deployado y el código fuente | 30 min |

### MEJORAS (verde — cuando haya tiempo)

- Eliminar `lodash` de `package.json` (no se usa en ningún archivo) y evaluar reemplazo de `xlsx` (sin parches desde 2023, CVEs conocidos en versiones antiguas).
- `services/db.ts` sigue existiendo como capa muerta paralela a `hooks/useDB.ts`.
- Grids/headers con estilos inline no responsivos (MOB-3) y fuentes bloqueantes (MOB-6).
- KPIs de Financials suman toda la historia sin filtro de período (`Financials.tsx:159-164`).
- Modales "en desarrollo" (Subir Documento, Nueva Nota en PatientDetail) visibles como botones normales — generan frustración.
- Mover los `.sql` de la raíz a `supabase/migrations/`.
- Esquema JSONB sin índices ni columnas de filtro (pendiente desde mayo; todo el filtrado ocurre en el cliente y será problema de rendimiento al crecer los turnos).

---

## Verificación de puntos críticos de facturación

- **Cálculos de totales:** todos en frontend (no hay backend); mitigado con `toMoney()` aplicado en Financials (22 usos) y Payroll (9 usos). MEJORADO desde mayo.
- **Decimales:** float de JS + redondeo `toMoney` a 2 decimales — aceptable a corto plazo, no ideal para dinero.
- **Estados de factura:** máquina razonable (draft/pending/partial/paid/overdue/void); la eliminación ahora está restringida a draft/pending (`Financials.tsx:495`). MEJORADO.
- **Numeración:** correlativo secuencial pero **no atómico** (C4) — riesgo de duplicados con 2+ usuarios. PERSISTE.
- **Anulaciones:** se marcan `void`, no se borran. CORRECTO.
- **Auditoría:** sin registro real de quién creó/anuló (I5); las facturas no llevan `created_by`. PENDIENTE.

---

## Quick wins (< 2 horas cada uno)

1. **Arreglar el cierre de modal por overlay** (`Modal.tsx`): cerrar solo si mousedown+mouseup ocurren en el overlay — elimina la mayor fuente de "se cerró solo".
2. **Envolver las tablas de Patients/Nurses en `.table-wrapper`** y quitar el `overflow: hidden` del card.
3. **Optional chaining en `bank_info` y guarda en `parseISO`** en Nurses/NurseDetail (evita 2 crashes conocidos de app completa).
4. **Quitar el "Próximo Turno" falso** de `Patients.tsx` (o calcularlo desde `shifts`).
5. **Resetear `QuickAddPatientModal` al abrir** + regenerar el código por paciente + guardar `initial_observations`.
6. **Registrar el usuario real** (`profile.full_name` de `useAuth()`) en el historial en lugar del placeholder.
7. **Escapar comillas dobles en el export CSV** de Financials.
8. **Commitear/limpiar** los cambios pendientes de Calendar/Payroll y los archivos sueltos de la raíz.
9. **Eliminar `lodash`** de package.json.

## Deuda técnica grande (orden recomendado)

1. **Refactor de `useDB`** (16-24 h): upsert solo de filas modificadas, ignorar ecos realtime propios, no persistir SELECT vacíos sin validar sesión, pausar refetch durante ediciones. Es el fundamento de la confiabilidad multi-usuario.
2. **Correlativos atómicos en PostgreSQL** (6-10 h) — requisito legal de facturación.
3. **Unificación del expediente de paciente** (20-30 h): formulario/wizard único, alergias editables, fusionar Responsables con Clientes, arreglar I1.
4. **Partir los monolitos** (30-40 h): `PatientDetail.tsx` (3,393 líneas), `Payroll.tsx` (2,171), `Financials.tsx` (1,556), `Calendar.tsx` (1,509).
5. **Code-splitting y presupuesto de bundle** (4-6 h).
6. **Índices/columnas generadas en Supabase** para fecha/estado/cliente (4-6 h).

## Recomendaciones de orden (próximos 14 días)

- **Día 1-2:** Quick wins 1, 2 y 3 (modal + tablas móviles + crashes conocidos) y agregar un ErrorBoundary global con botón "recargar". Con esto el síntoma reportado debería desaparecer casi por completo.
- **Día 3-5:** C5 (manejo de sesión expirada sin desmontar la vista), quick wins 4-8. Probar en un teléfono real el flujo completo de edición de enfermera y paciente.
- **Día 6-10:** C3 — refactor de `useDB` fase 1 (no pisar ediciones, no guardar vacíos, ignorar ecos propios).
- **Semana 2:** C4 (correlativos atómicos), I1/I2/I3 (expediente de paciente), I6/I7 (endurecer RLS por rol + autenticación del endpoint de email), I8 (code-splitting).

## Métricas

- **Total de archivos analizados:** ~60 (de 81 archivos en `src/` + `api/`)
- **Líneas de código aproximadas:** 29,557 (TS/TSX/CSS en `src/`)
- **Tamaño del build:** JS principal 2,063 KB (553 KB gzip) + CSS 120 KB, un solo chunk
- **Vistas:** 15 — **Modales:** ~30 — **Media queries:** 46 en 16 archivos
- **Hallazgos críticos:** 5
- **Hallazgos importantes:** 12
- **Quick wins identificados:** 9
- **Hallazgos de mayo verificados como corregidos:** 10 (toMoney, table-wrappers Financials/Payroll, touch targets 44px, touch-action, breakpoints de Settings, búsqueda móvil del TopBar, filtros móviles del calendario, README real, eliminación de facturas restringida, crypto.randomUUID en Financials)

## Lo que NO pude evaluar

1. Reproducción en dispositivo físico (iOS Safari / Chrome Android) — los hallazgos móviles son por análisis de código/CSS.
2. Comportamiento real del refresh de sesión de Supabase en producción (las hipótesis E3.4/E4 requieren observar logs o reproducir con sesión expirada).
3. Estado real de las políticas RLS en el proyecto Supabase (solo vi los scripts en el repo; no sé cuáles se ejecutaron).
4. Volumen de datos real (rendimiento del refetch completo con cientos de turnos/facturas).
5. Contenido de `.env` y si las credenciales han rotado (existe en disco, correctamente ignorado por git).
6. Si el build deployado en Vercel corresponde al código actual (hay cambios sin commitear en Calendar/Payroll).
7. Los documentos de "Cambios solicitados" (.docx) — fuera del alcance de código.
