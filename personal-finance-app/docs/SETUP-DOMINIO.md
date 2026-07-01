# SETUP — Dominio del portfolio

> **Estado: HECHO.** Dominio comprado en **Cloudflare**: `gfirm.dev`. La app vive en el
> subdominio **`cuotapp.gfirm.dev`** (Custom Domain en Vercel, HTTPS automático). En prod,
> `BETTER_AUTH_URL` y `NEXT_PUBLIC_APP_URL` apuntan a ese subdominio.
>
> **Mails:** el subdominio `cuotapp.gfirm.dev` se está verificando en Resend (SPF/DKIM vía
> Cloudflare). El paso final es cambiar `EMAIL_FROM` a `noreply@cuotapp.gfirm.dev` una vez
> que Resend lo marque *Verified*. Ver `docs/SETUP-EMAILS.md` → paso 4.

Las notas de abajo son el razonamiento de la decisión (registrar, TLD, estructura de
subdominios), que se conserva como registro del porqué.

## Idea: un dominio para todo el portfolio (subdominios)

No hace falta comprar un dominio por app. Con **un solo** dominio se cuelga cada proyecto de
un **subdominio**, sin costo extra (los subdominios son registros DNS, ilimitados y gratis):

```
tudominio.dev            → portfolio principal
cuotapp.tudominio.dev    → esta app
otraapp.tudominio.dev    → otro proyecto
```

- **Vercel:** a cada app se le asigna un *Custom Domain* (ej. `cuotapp.tudominio.dev`) en vez
  de la URL `*.vercel.app`. Vercel da el registro DNS a cargar y maneja el HTTPS solo.
- **Resend (mails):** se verifica el subdominio (`cuotapp.tudominio.dev`) y `EMAIL_FROM` queda
  `CuotApp <noreply@cuotapp.tudominio.dev>`. Usar un subdominio para enviar es la **práctica
  recomendada**: aísla la reputación de envío de cada app de la del dominio raíz.

**Costo:** una sola compra (~USD 12-15/año) cubre el portfolio + todas las apps por subdominio
+ los mails. Comprar un dominio por proyecto multiplica ese costo sin ninguna ventaja real.

## Dónde comprar (registrars)

> Más importante que el precio del primer año: el **precio de renovación** (muchos enganchan
> con primer año barato y renuevan caro) y que la **privacidad WHOIS sea gratis**.

| Registrar | Cómo es | Para quién |
|---|---|---|
| **Cloudflare Registrar** | Vende **a precio de costo**, sin markup. Año 1 = renovación, sin ofertas-gancho. WHOIS gratis. DNS propio incluido (rápido). | **La opción más honesta — recomendada.** |
| **Porkbun** | Barato y transparente, buena UI, WHOIS gratis, muchísimos TLDs. | Si el TLD no está en Cloudflare. |
| **Namecheap** | Popular, soporte ok. Ojo: primer año con descuento, renueva más caro. | Alternativa conocida. |
| ~~Google Domains~~ | **Ya no existe** (Google lo vendió a Squarespace en 2023). Evitar Squarespace Domains (caro). | — |

## Precios típicos por TLD (aprox., USD/año, renovación)

> Rangos orientativos 2026 — cambian según registrar. **Verificar el precio de renovación**
> antes de comprar, no solo el de oferta.

| TLD | Precio aprox. | Notas |
|---|---|---|
| `.com` | ~10-12 | El estándar, el más reconocible. |
| `.dev` | ~12-15 | Muy usado para portfolios técnicos. Fuerza HTTPS (bien). |
| `.app` | ~14-18 | Como `.dev`, fuerza HTTPS. |
| `.me` | ~10-20 | Bueno para portfolio personal (`gregorio.me`). |
| `.io` | ~30-40 | Popular en tech pero **caro** y subiendo. |
| `.xyz` | ~2-12 | Barato, menos "serio" según el nombre. |
| `.ar` / `.com.ar` | variable | El de Argentina (NIC.ar), gestión local. Para portfolio internacional `.com`/`.dev` rinde más. |

## Recomendación para este caso

1. **TLD:** `.dev` o `.com` (~USD 12-15/año). `.dev` cuenta la historia "soy dev" y fuerza
   HTTPS; `.com` es el más universal.
2. **Registrar:** **Cloudflare** (precio de costo, sin sorpresas en la renovación, WHOIS
   gratis). Si el TLD no está, **Porkbun**.
3. **DNS:** manejarlo desde Cloudflare → desde un solo panel se cargan los CNAME para Vercel
   y los SPF/DKIM para Resend.

## Checklist

- [x] Comprar 1 dominio → **`gfirm.dev`** (Cloudflare Registrar).
- [x] Apuntar `cuotapp.gfirm.dev` a la app en Vercel (Custom Domain, HTTPS automático).
- [x] Actualizar `BETTER_AUTH_URL` y `NEXT_PUBLIC_APP_URL` en Vercel al subdominio + redeploy.
- [ ] Verificar el subdominio en Resend (SPF/DKIM vía Cloudflare) — **en proceso**, ver `docs/SETUP-EMAILS.md` paso 4.1.
- [ ] Cambiar `EMAIL_FROM` en Vercel a `CuotApp <noreply@cuotapp.gfirm.dev>` + redeploy (cuando Resend marque *Verified*).
