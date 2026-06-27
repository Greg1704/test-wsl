# SETUP — Sistema de mails (Resend)

Pasos manuales para dejar andando las dos features de mail:

1. **Recuperación de contraseña** (link de reset).
2. **Reporte mensual de deudas** (cron del día 1, opt-in).

El código ya está implementado y testeado. Lo que falta es **configuración** (cuenta,
claves, variables) — nada de esto se commitea con valores reales.

---

## 1. Crear la cuenta de Resend

1. Registrate en [resend.com](https://resend.com) (free tier: 3.000 mails/mes, 100/día).
2. En el dashboard → **API Keys** → *Create API Key* (permiso *Sending access* alcanza).
   Copiala: la vas a usar como `RESEND_API_KEY`. **Se muestra una sola vez.**

> Para **desarrollo** podés enviar desde el dominio de prueba `onboarding@resend.dev`
> sin verificar nada. Para **producción** necesitás un dominio propio (paso 4).

---

## 2. Variables de entorno en local (`.env`)

Agregá estas tres a tu `.env` (ya están documentadas en `.env.example`):

```bash
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxx"          # la del paso 1
EMAIL_FROM="CuotApp <onboarding@resend.dev>"       # en dev, el dominio de prueba de Resend
CRON_SECRET="pegá-acá-lo-que-genere-el-comando"    # ver abajo
```

> ⚠️ Cuidado con `EMAIL_FROM`: el dominio es `resend.dev` (con **punto**). Un typo como
> `resend-dev` lo vuelve un remitente inválido y Resend rechaza el envío. El fallo no se
> ve en la UI (muestra un mensaje neutro); se ve en la consola del dev server con el log
> `[email] No se pudo enviar…`.

Generá el `CRON_SECRET` (protege el endpoint del reporte mensual):

```bash
openssl rand -base64 32
```

> Si usás Docker para dev, recordá que el contenedor `app` toma las variables del `.env`
> del compose / del entorno. Verificá que estas tres lleguen al contenedor.

---

## 3. Probar en local

### Recuperación de contraseña
1. `npm run dev` (o el contenedor).
2. Andá a **/login** → clic en **"¿La olvidaste?"** → ingresá el email de una cuenta.
3. Revisá el mail (o el **dashboard de Resend → Emails** para ver el envío).
4. Abrí el link → definí una contraseña nueva → inicia sesión con ella.

> El flujo es **link de reset**, no contraseña provisoria: el usuario define su nueva
> contraseña en `/reset-password`. El token vence en **1 hora** y es de un solo uso.

> ℹ️ **Dominio de prueba (`onboarding@resend.dev`): solo entrega a tu propia dirección.**
> El free tier de Resend, sin un dominio verificado, únicamente permite enviar al email
> con el que te registraste en Resend. Para probar el reset en local, usá una cuenta de
> CuotApp con **ese mismo email**, o mirá el envío en **Resend → Emails** (vas a ver
> `delivered` vs `bounced` con el motivo). Esto se levanta al verificar un dominio (paso 4).

### Reporte mensual
1. Andá a **/configuracion** → sección **Notificaciones** → activá *"Reporte mensual por mail"*.
2. Asegurate de tener al menos una cuota que venza en el mes actual (si no, el reporte se saltea).
3. Disparalo a mano (en local el cron NO corre solo). Ojo: `$CRON_SECRET` **no** está en
   tu shell —el `.env` lo carga Next.js, no la terminal—, así que `$CRON_SECRET` saldría
   vacío y el header sería `Bearer ` → **401**. Leé el valor del `.env` en el mismo comando:

```bash
curl -s -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env | cut -d= -f2- | tr -d '\"')" \
  http://localhost:3000/api/cron/monthly-report; echo
```

   - Respuesta esperada: `{"processed":N,"sent":N,"skipped":N,"failed":0}`.
   - Si querés verificar el **401**, mandalo sin header (o con un secreto cualquiera):
     `curl -i http://localhost:3000/api/cron/monthly-report` → debe dar `401`.

---

## 4. Producción (Vercel + Neon)

### 4.1 Verificar un dominio en Resend
1. Resend → **Domains** → *Add Domain* → poné tu dominio (ej. `cuotapp.com`).
2. Cargá en tu proveedor de DNS los registros que te da Resend (**SPF** y **DKIM**).
3. Esperá a que Resend lo marque como **Verified**.
4. A partir de ahí, `EMAIL_FROM` puede ser `CuotApp <noreply@tudominio.com>`.

> Sin dominio verificado, en prod solo podés mandar a tu propia dirección. La verificación
> es lo que habilita mandarle a cualquier usuario.

> ⚠️ **El dominio de Vercel (`*.vercel.app`, ej. `personal-finance-app-gf.vercel.app`) NO
> sirve para esto.** La verificación necesita cargar registros DNS (SPF/DKIM) en la zona del
> dominio, y `vercel.app` es de Vercel: no controlás su DNS, así que Resend nunca lo va a
> marcar como *Verified*. Hace falta un **dominio propio** (comprado).
>
> **Plan a futuro — un dominio para todo el portfolio (subdominios).** No hace falta comprar
> un dominio por app. Con **un solo** dominio (ej. `tudominio.dev`) se cuelga cada proyecto de
> un **subdominio** sin costo extra (los subdominios son registros DNS, ilimitados y gratis):
> `cuotapp.tudominio.dev`, `otraapp.tudominio.dev`, etc. Para esta app, en Resend se verifica
> el subdominio (`cuotapp.tudominio.dev`) y `EMAIL_FROM` queda `CuotApp <noreply@cuotapp.tudominio.dev>`.
> Usar un subdominio para el envío es además la **práctica recomendada**: aísla la reputación
> de envío de cada app de la del dominio raíz. Comparado con comprar un dominio por proyecto,
> esto cuesta **una sola compra** (~USD 10-15/año) en vez de multiplicarla por cada app.
>
> **Estado actual: PENDIENTE.** Todavía no se compró un dominio. Hasta entonces, en
> producción dejamos `EMAIL_FROM` con el dominio de prueba `onboarding@resend.dev` (solo
> entrega a la propia dirección registrada en Resend — alcanza para la demo de portfolio).
> El día que se compre el dominio: verificar el subdominio acá y cambiar **solo** `EMAIL_FROM`
> en Vercel.

### 4.2 Variables en Vercel
*Project Settings → Environment Variables* (marcá **Production**):

| Variable | Valor |
|---|---|
| `RESEND_API_KEY` | la API key de Resend (podés usar una distinta a la de dev) |
| `EMAIL_FROM` | `CuotApp <noreply@tudominio.com>` (dominio verificado) |
| `CRON_SECRET` | uno nuevo: `openssl rand -base64 32` |

> Vercel inyecta `CRON_SECRET` automáticamente como header `Authorization: Bearer <CRON_SECRET>`
> cuando dispara el cron. No hay que configurar nada más para que el endpoint lo valide.

### 4.3 El cron ya está declarado
`vercel.json` tiene el cron configurado:

```json
{ "crons": [{ "path": "/api/cron/monthly-report", "schedule": "0 9 1 * *" }] }
```

Corre el **día 1 de cada mes a las 09:00 UTC**. En el plan **Hobby** de Vercel el cron
dispara como máximo 1×/día, así que un cron mensual entra sin problema. Lo ves en
*Vercel → Project → Crons* una vez deployado.

---

## 5. Checklist rápido

- [ ] Cuenta de Resend creada y API key copiada.
- [ ] `.env` local con `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`.
- [ ] Flujo de reset probado en local (mail recibido + contraseña cambiada).
- [ ] Reporte mensual probado con `curl` (200 con el secret, 401 sin él).
- [ ] ~~Dominio verificado en Resend (SPF/DKIM) para producción.~~ **PENDIENTE: comprar 1 dominio para el portfolio y verificar el subdominio `cuotapp.tudominio` en Resend** (el `*.vercel.app` no sirve). Mientras tanto, prod usa `onboarding@resend.dev`.
- [ ] Las tres variables cargadas en Vercel (Production).
- [ ] Deploy hecho → cron visible en *Vercel → Crons*.

---

## Notas

- **No hace falta** ninguna migración manual extra: `add_monthly_report_enabled` ya está
  versionada en `prisma/migrations/` y se aplica sola en el deploy
  (`prisma migrate deploy`, ver `docs/ARCHITECTURE.md` → Deployment).
- El opt-in arranca **desactivado** para todos (`monthlyReportEnabled` default `false`):
  cada usuario lo prende desde Configuración. Nadie recibe el reporte sin activarlo.
- Free tier de Resend: **100 mails/día**. Si algún día el reporte mensual supera 100
  usuarios con deuda, hay que paginar el envío en varios días o subir de plan.
