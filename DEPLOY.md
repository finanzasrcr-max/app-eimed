# DEPLOY — feature/audit-fixes-2026-05

Fecha de preparacion: 2026-05-28
Preparado por: DevOps (Claude Code / Sonnet 4.6)
Estado: PENDIENTE DE APROBACION HUMANA — no ejecutar hasta confirmar cada paso.

---

## 1. Rama a integrar

| Origen | Destino |
|--------|---------|
| `feature/audit-fixes-2026-05` | `main` |

Esta rama contiene 12 commits de correcciones de auditoria agrupados en tres fases:
- Fase 1 Mobile: tablas con scroll horizontal, touch targets 44 px, breakpoints Settings, icono lupa en TopBar.
- Fase 2 Seguridad: utilidad `toMoney()`, IDs con `crypto.randomUUID()`, bloqueo de admin local en produccion, restriccion de borrado de facturas a estado draft/pending.
- Fase 3 Calidad: `quotations` en TABLE_MAP, README actualizado, drawer de filtro de calendario en mobile, correcciones de overflow e icon-btn en invoice wizard.

---

## 2. Checklist pre-merge (ejecutar manualmente antes del merge)

El build de TypeScript ya fue verificado en CI. Igualmente confirmar:

- [ ] Ejecutar `npm run build` localmente y confirmar salida sin errores ni advertencias de TypeScript.
- [ ] Abrir la app en un dispositivo movil real o DevTools en modo mobile (375px / iPhone SE):
  - [ ] Financials: tabla con scroll horizontal visible y funcional.
  - [ ] Payroll: tabla con scroll horizontal visible y funcional.
- [ ] Abrir en tablet (768px):
  - [ ] Settings: layout no se rompe, todos los controles son accesibles.
- [ ] Abrir en viewport menor a 480px:
  - [ ] TopBar: el icono de lupa aparece en lugar del campo de busqueda de texto.
- [ ] Verificar en Supabase Dashboard que RLS y GRANTs de `ap_payments` / `ar_payments` siguen activos (no fueron tocados en esta rama, pero confirmar como precaucion).
- [ ] Revisar que el archivo `.env` local NO esta incluido en el commit (`git status` limpio).

---

## 3. Comando de merge (el humano lo ejecuta, no este script)

```bash
git checkout main
git merge --no-ff feature/audit-fixes-2026-05 -m "feat: correcciones de auditoria movil, seguridad y calidad (2026-05-28)"
```

El flag `--no-ff` conserva el historial de la rama en el grafo de commits. No usar `--squash`.

---

## 4. Variables de entorno

### Cambios en esta rama

Ninguna variable de entorno es nueva ni fue modificada en esta rama. El archivo `.env.example` permanece igual.

### Variables requeridas en produccion

Las siguientes variables deben estar configuradas en el dashboard de Vercel antes del deploy. No se incluyen valores reales en este archivo.

| Variable | Alcance | Descripcion |
|----------|---------|-------------|
| `VITE_SUPABASE_URL` | Build-time (VITE) | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Build-time (VITE) | Anon key publica de Supabase |
| `RESEND_API_KEY` | Server-side (Edge Functions / API routes) | Clave de la API de Resend para envio de correos |
| `RESEND_FROM` | Server-side | Direccion "from" para reportes de enfermeria |

Ruta para verificarlas: Vercel Dashboard > Proyecto app-eimed > Settings > Environment Variables.

Las variables con prefijo `VITE_` son embebidas en el bundle en tiempo de build; las demas son secretos de servidor que Vercel inyecta en Edge Functions.

---

## 5. Pasos de build

El proyecto usa Vite + TypeScript. El build lo ejecuta Vercel automaticamente al detectar un push a `main`.

```bash
# Instalar dependencias (Vercel lo hace internamente, documentado aqui para referencia)
npm ci

# Build de produccion
npm run build
# Equivale a: tsc -b && vite build
# Salida en: dist/
```

Framework preset en Vercel: **Vite**.
Directorio de salida: `dist` (detectado automaticamente por Vercel).
Node version recomendada: 20.x LTS (configurar en Vercel > Settings > General > Node.js Version si no esta en 20).

---

## 6. Despliegue en Vercel (auto-deploy)

Vercel esta configurado con deploy automatico al branch `main`. No se requiere ningun comando adicional de push desde este repositorio para disparar el deploy; basta con que el merge llegue a `main` en el remoto.

### Pasos manuales post-merge

1. Confirmar en el Vercel Dashboard que el build se disparo automaticamente tras el push a `main`.
2. Esperar a que el estado del deployment cambie a **Ready** (usualmente 1-3 minutos para este proyecto).
3. Copiar la URL de preview del deployment antes de promoverlo a produccion si se quiere una verificacion extra.
4. Si el proyecto tiene un dominio personalizado en hPanel/Hostinger apuntando a Vercel (registro CNAME o A hacia `cname.vercel-dns.com`), no hay accion adicional en hPanel: Vercel sirve el bundle nuevo automaticamente.

### Configuracion vercel.json relevante

- Todas las rutas no-API reescriben a `/index.html` (SPA routing).
- Cron `/api/ping` se ejecuta cada 5 dias al mediodia UTC (no fue modificado en esta rama).

---

## 7. Checklist de verificacion post-deploy

Ejecutar contra la URL de produccion una vez el deployment este en estado **Ready**.

### App levanta
- [ ] La URL de produccion carga la pantalla de login sin errores en consola.
- [ ] El bundle de JS carga sin errores 404 (verificar Network tab en DevTools).

### Base de datos conecta
- [ ] Iniciar sesion con un usuario real de prueba.
- [ ] Confirmar que el dashboard principal carga datos (Financials o Payroll) sin errores de red hacia Supabase.
- [ ] Abrir DevTools > Network, filtrar por `supabase.co` y confirmar que las respuestas retornan HTTP 200, no 401 ni 403.

### Flujo critico — creacion y restriccion de facturas
- [ ] Crear una factura nueva y confirmar que el ID generado tiene formato UUID (no un numero de timestamp).
- [ ] Intentar borrar una factura en estado `sent` o `paid` y confirmar que la UI bloquea la accion (el boton no aparece o muestra mensaje de error).
- [ ] Crear una cotizacion nueva y confirmar que se guarda correctamente en Supabase (regression de fix `quotations` en TABLE_MAP).

### Verificacion mobile (desde DevTools o dispositivo real)
- [ ] En viewport 375px: Financials y Payroll muestran scroll horizontal sin contenido cortado.
- [ ] En viewport 375px: TopBar muestra icono de lupa en lugar del campo de texto.
- [ ] En viewport 768px: Settings se despliega sin overflow ni elementos superpuestos.

---

## 8. Rollback

Si el deploy produce un error critico, revertir en el siguiente orden:

### Opcion A — Rollback instantaneo en Vercel (recomendada)

En Vercel Dashboard > Deployments, seleccionar el ultimo deployment estable y hacer clic en **Promote to Production**. Este proceso no requiere tocar git y tarda menos de 30 segundos.

### Opcion B — Revert via git (si el problema esta en el codigo y no solo en el deploy)

Revertir los 12 commits en orden inverso (del mas reciente al mas antiguo). Ejecutar cada comando por separado y verificar que el build pasa entre reverts si es necesario.

```bash
git revert 7034908  # fix(review): overflow, icon-btn specificity y toMoney en invoice wizard
git revert ff102bc  # feat(mobile): add calendar filter drawer trigger on mobile
git revert 46a1a4b  # docs: rewrite README.md with real setup instructions
git revert 150aa3e  # fix(db): add quotations to TABLE_MAP in useDB.ts
git revert 9aba558  # fix(invoices): restrict deletion to draft/pending status only
git revert 75ed1d1  # fix(security): block local admin fallback in production builds
git revert 2c3c308  # feat(ids): replace Date.now()/Math.random() with crypto.randomUUID()
git revert 5860bd0  # feat(money): create utils/money.ts toMoney() and apply in Financials/Payroll
git revert fde9c13  # feat(mobile): add search icon fallback in TopBar at <480px
git revert fd0b095  # feat(mobile): add 768px/640px breakpoints to Settings.css
git revert 816f0fa  # feat(mobile): increase touch targets to 44px and add touch-action:manipulation
git revert a021a72  # feat(mobile): wrap all tables in table-wrapper — Financials and Payroll
```

Despues de los reverts, ejecutar `npm run build` para confirmar que el build pasa y hacer push a `main`. Vercel re-desplegara automaticamente.

Nota: `git revert` crea commits nuevos; no reescribe historia. Es seguro en `main` sin necesidad de `--force`.

---

## 9. Deuda tecnica pendiente (siguiente sprint)

Los siguientes items fueron identificados en la auditoria pero quedan fuera del scope de esta rama. Registrar como tickets antes de cerrar el sprint.

| ID | Descripcion | Riesgo |
|----|-------------|--------|
| DT-01 | `Math.random()` y `Date.now()` persisten en otros 9 archivos no tocados en esta rama | Medio — IDs predecibles en esos modulos |
| DT-02 | Race condition en numeracion de correlativos: dos usuarios concurrentes pueden obtener el mismo numero | Alto — requiere `SELECT ... FOR UPDATE` en PostgreSQL o una secuencia nativa |
| DT-03 | Route guards para `/settings` no implementados — cualquier usuario autenticado puede navegar a esa ruta | Medio — control de acceso incompleto |
| DT-04 | Variable `gross` sin pasar por `toMoney()` en calculos intermedios de Payroll — riesgo de error de punto flotante en acumulaciones | Medio — puede generar centavos de diferencia en reportes |
| DT-05 | Busqueda global del TopBar renderiza el campo/icono pero no tiene funcionalidad real conectada al backend | Bajo — UX incompleta, no es un bug de seguridad |

---

*Este archivo fue generado como documentacion de deploy. No contiene secretos ni valores reales de variables de entorno. Antes de ejecutar cualquier paso, el responsable humano debe revisar y aprobar cada seccion.*
