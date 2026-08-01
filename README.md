# 🎞️ Bitácora de Cine de Camaro

App web simple para que Cami y Lauti registren las películas que ven juntos: ficha técnica autocompletada desde TMDb, valoración + comentario de cada uno, y un Top 10 conjunto que se arma solo.

Sin frameworks ni build step — HTML, CSS y JS puro. Se puede abrir directo o deployar como sitio estático (ej. Vercel).

## 1. Crear proyecto en Supabase (base de datos compartida)

1. Andá a [supabase.com](https://supabase.com) y creá una cuenta / proyecto nuevo (gratis).
2. En el panel del proyecto, andá a **SQL Editor** → pegá y ejecutá el contenido de [`supabase/schema.sql`](supabase/schema.sql). Esto crea las tablas `movies` y `ratings`.
3. Andá a **Project Settings → API** y copiá:
   - **Project URL**
   - **anon public key**

## 2. Conseguir API key de TMDb (datos de películas)

1. Creá una cuenta gratis en [themoviedb.org](https://www.themoviedb.org/signup).
2. Andá a **Settings → API** → pedí una API key (uso personal/no comercial, la aprueban al toque).
3. Copiá la **API Key (v3 auth)**.

## 3. Configurar la app

Editá [`js/config.js`](js/config.js) con tus claves:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://tu-proyecto.supabase.co",
  SUPABASE_ANON_KEY: "tu-anon-key",
  TMDB_API_KEY: "tu-api-key-de-tmdb",
};
```

Este archivo está en `.gitignore` así que tus claves no se suben al repo.

## 4. Correrla local

Como no tenés Node ni Python instalados, incluí un script de PowerShell que levanta un servidor local sin instalar nada:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

y entrá a `http://localhost:8791`. (Si en algún momento instalás Python o Node, también podés usar `python -m http.server 8000` o `npx serve`.)

## 5. Deploy en Vercel

1. Subí el proyecto a un repo de GitHub.
2. En [vercel.com](https://vercel.com), importá el repo → "Framework Preset: Other" → Deploy (no necesita build command, es estático).
3. **Importante:** como `config.js` no se sube al repo (está en `.gitignore`), tenés que agregar tus claves de otra forma en producción. La opción más simple: sacá esa línea del `.gitignore` y subí `config.js` igual — como la `anon key` de Supabase y la key de TMDb están pensadas para usarse del lado del cliente, no es grave que queden visibles en un proyecto privado como este. Si preferís no subirlas, se puede migrar a variables de entorno de Vercel más adelante.

## Cómo funciona

- **Perfiles:** al entrar elegís "Cami" o "Lauti" (se guarda en el navegador, sin contraseña).
- **Agregar película:** buscás por título, TMDb autocompleta director, elenco, duración, fecha, presupuesto y recaudación. Vos completás a mano las locaciones de filmación y en qué países le fue bien (esos datos no existen en ninguna API gratuita confiable).
- **Valorar:** cada uno pone su puntaje (1–10) y un comentario corto sobre la película.
- **Top 10:** se arma automáticamente ordenando por el promedio de ambas valoraciones.
