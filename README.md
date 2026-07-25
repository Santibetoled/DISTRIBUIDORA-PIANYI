# Distribuidora Pianyi — Portal Central

Portal de gestión integral para Distribuidora Pianyi.

## Setup

### 1. Crear repo en GitHub
- Nuevo repo: `Santibetoled/distribuidora-pianyi`
- Subir todos estos archivos

### 2. Configurar Supabase
- Abrir `src/supabase.js`
- Copiar la URL y anon key del proyecto existente (mismo que control-transferencias)
- Ejecutar `AGREGAR_USUARIO.sql` en el SQL Editor de Supabase

### 3. Deploy en Vercel
- Importar el nuevo repo desde Vercel
- Framework: Vite
- El dominio será algo como `distribuidora-pianyi.vercel.app`

## Stack
- React 18 + Vite
- Supabase (misma instancia que control-transferencias)
