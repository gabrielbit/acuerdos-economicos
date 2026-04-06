# Deploy: Vercel + Supabase

## 1. Supabase (base de datos)

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a **Settings > Database** y copiar el **Connection string (URI)**
   - Formato: `postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
3. Correr las migraciones:
   ```bash
   DATABASE_URL="tu-connection-string" npm run --workspace=api migrate
   ```
4. Correr el seed con datos reales:
   ```bash
   DATABASE_URL="tu-connection-string" npm run --workspace=api seed:real
   ```

## 2. Vercel — API

1. Importar el repo en Vercel
2. Configurar:
   - **Root Directory:** `api`
   - **Framework Preset:** Other
3. Variables de entorno:
   - `DATABASE_URL` = connection string de Supabase
   - `JWT_SECRET` = un string seguro aleatorio
   - `CORS_ORIGIN` = URL del frontend (ej: `https://acuerdos-web.vercel.app`)
4. Deploy

La URL del API será algo como `https://acuerdos-api.vercel.app`

## 3. Vercel — Web

1. Importar el **mismo repo** como otro proyecto en Vercel
2. Configurar:
   - **Root Directory:** `web`
   - **Framework Preset:** Vite
3. Variables de entorno:
   - `VITE_API_URL` = URL del API (ej: `https://acuerdos-api.vercel.app`)
4. Deploy

## Desarrollo local

```bash
# Terminal 1 — API
npm run --workspace=api dev

# Terminal 2 — Web
npm run --workspace=web dev
```

Login: `admin@colegio.com` / `admin123`
