# EIMED CareOps

Sistema web de gestión clínica y financiera para empresas de cuidados domiciliarios.
Permite administrar pacientes, enfermeras, turnos, facturación, planilla, cotizaciones y reportes desde un solo lugar.

## Stack tecnológico

- **Frontend:** React 19 + TypeScript + Vite
- **Base de datos / Auth:** Supabase (PostgreSQL + Row Level Security)
- **Estilos:** CSS custom con variables (sin framework de UI externo)
- **Deploy:** Vercel (con funciones serverless en `/api`)
- **Email:** Resend (reportes de enfermeras)

## Prerrequisitos

- Node.js >= 18
- Cuenta en [Supabase](https://supabase.com) (gratuita)
- Cuenta en [Vercel](https://vercel.com) (opcional, solo para deploy)

## Instalacion

```bash
npm install
cp .env.example .env
# Editar .env con tus credenciales de Supabase
npm run dev
```

La aplicacion estara disponible en `http://localhost:5173`.

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

| Variable              | Descripcion                                                   |
|-----------------------|---------------------------------------------------------------|
| `VITE_SUPABASE_URL`   | URL del proyecto Supabase (`https://xxxx.supabase.co`)        |
| `VITE_SUPABASE_ANON_KEY` | Clave publica `anon/public` del proyecto Supabase          |
| `RESEND_API_KEY`      | Clave de API de Resend (para envio de reportes por email)     |
| `RESEND_FROM`         | Direccion de origen del email (ej. `Eimed <reportes@dominio.com>`) |

Sin `.env` configurado la app funciona completamente en modo local (localStorage).
Con `.env` configurado los datos se sincronizan en tiempo real entre todos los usuarios.

## Configuracion de Supabase

1. Crear un proyecto en Supabase y anotar la URL y la clave `anon/public`.
2. En **SQL Editor**, ejecutar el contenido completo de `supabase_schema.sql`.
3. Copiar URL y clave al archivo `.env` (ver seccion anterior).
4. Crear el primer usuario en **Authentication > Users > Add user** y asignarle rol `admin` via SQL.

Para pasos detallados y migracion de datos existentes desde localStorage, ver `MIGRATION_GUIDE.md`.

## Deploy en Vercel

El archivo `vercel.json` ya esta configurado con las rutas SPA y las funciones serverless de `/api`.

```bash
# Con la CLI de Vercel:
vercel --prod
```

Las variables de entorno deben configurarse en el panel de Vercel (Settings > Environment Variables).
`RESEND_API_KEY` y `RESEND_FROM` solo son necesarias en el servidor; `VITE_*` se inyectan en el build.

## Modulos principales

| Modulo       | Descripcion                                                          |
|--------------|----------------------------------------------------------------------|
| Pacientes    | Registro de pacientes con tarifas por tipo de turno                  |
| Turnos       | Calendario mensual y timeline, programacion con repeticion           |
| Financiero   | Facturas, recibos, cotizaciones, pagos a proveedores y clientes      |
| Planilla     | Liquidacion de honorarios de enfermeras, ajustes y exportacion       |
| Calendario   | Vista mes/timeline con filtros por paciente, enfermera y estado      |
| Reportes     | Reporte mensual por enfermera o paciente, exportable a PDF           |

## Roles

- **Admin:** acceso total (crear, editar, eliminar)
- **Operativo:** puede ver todo y crear/modificar turnos
