# Guía de Migración a Supabase

## Paso 1 — Crear cuenta en Supabase

1. Ir a https://supabase.com y crear cuenta gratis
2. Crear nuevo proyecto (nombre: "eimed-app")
3. Elegir región más cercana (ej: South America / us-east-1)
4. Anotar la contraseña del proyecto

## Paso 2 — Ejecutar el schema SQL

1. En el panel de Supabase, ir a **SQL Editor**
2. Pegar todo el contenido del archivo `supabase_schema.sql`
3. Hacer clic en **Run**

## Paso 3 — Obtener las credenciales

1. Ir a **Project Settings > API**
2. Copiar:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY`

## Paso 4 — Configurar el .env

Editar el archivo `.env` en la raíz del proyecto:

```
VITE_SUPABASE_URL=https://XXXXXXXXXXXX.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Paso 5 — Crear el primer usuario (Admin)

1. En Supabase: ir a **Authentication > Users > Add user**
2. Ingresar tu email y contraseña
3. En **SQL Editor**, ejecutar:
   ```sql
   update public.profiles
   set role = 'admin', full_name = 'Tu Nombre'
   where email = 'tu@email.com';
   ```

## Paso 6 — Migrar datos existentes

Abrir la app (`npm run dev`), ir a **Ajustes > Usuarios**.
Hay un botón **"Migrar datos desde localStorage"** que sube todos
los datos actuales a Supabase en un solo click.

## Paso 7 — Crear los demás usuarios

En la app: **Ajustes > Usuarios > Agregar Usuario**
- Nombre, email, contraseña temporal, rol (Admin / Operativo)

## Notas importantes

- **Sin .env configurado**: la app sigue funcionando 100% en modo local (localStorage), igual que antes.
- **Con .env configurado**: los datos se sincronizan en tiempo real entre todos los usuarios.
- **Roles**:
  - **Admin**: acceso total (crear, editar, eliminar todo)
  - **Operativo**: puede ver todo, crear/modificar turnos

## ¿Problemas?

- Si aparece "Invalid API key": revisar que copiaste la clave `anon/public` (no la `service_role`)
- Si los datos no aparecen: ejecutar el script SQL completo de nuevo
- Si no se pueden crear usuarios: en Supabase > Auth > Settings, deshabilitar "Email confirmations"
