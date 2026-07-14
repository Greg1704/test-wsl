# Nota para analizar después — Rate limit distribuido (Redis serverless)

> Estado: **decisión pendiente.** Surge de la auditoría de seguridad (punto #1).
> No es un pendiente urgente: lo básico ya está mitigado (ver más abajo). Esto es
> para decidir con calma si conviene dar el salto al rate limit **distribuido**.

## De dónde arranca

Ya **no** estamos en cero. En la auditoría activamos el rate limit propio de Better
Auth con reglas estrictas por endpoint (`src/lib/auth.ts`):

- login: 8/min · signup: 5/min · **reset de contraseña: 1/min** (el más abusable:
  brute-force + email bombing / agotar la cuota de Resend).
- Activo **solo en producción**; store **en memoria**.

Entonces la pregunta no es "¿me protejo o no?", sino: **¿vale la pena el rate limit
distribuido (Redis serverless)?**

## El problema (por qué el default no alcanza en serverless)

En Vercel cada request corre en una función efímera que **no comparte memoria** con
las otras. El store en memoria cuenta intentos *por instancia*, así que un atacante
repartido entre varias lambdas puede diluir el conteo y saltear el límite. La solución
real es un **contador compartido** fuera de las funciones: un Redis serverless
(Upstash, o el KV de Vercel que por debajo es Upstash), que habla por HTTP/REST (una
request por invocación, sin pool que administrar).

## Cómo se encara (el trabajo)

1. Crear una base **Upstash Redis** (o Vercel KV) → URL + token REST.
2. Enchufar **`secondaryStorage`** en Better Auth (`get`/`set`/`delete`). Al definirlo,
   `rateLimit.storage` pasa a `"secondary-storage"` **automáticamente**.
3. **Bonus gratis:** ese mismo `secondaryStorage` **cachea las sesiones** → la
   verificación de sesión deja de pegarle a Postgres en cada request (baja carga de DB
   de todo el subsistema de auth, no solo del rate limit).
4. *(Opcional, avanzado):* conteo atómico real con `INCR` de Redis requiere un storage
   a medida; la interfaz genérica `get`/`set` sigue siendo read-modify-write.

**Esfuerzo:** pasos 1-3 ≈ 1 hora. Paso 4 ≈ medio día.

## Costos

**Monetarios: prácticamente $0 para un portfolio.**

| Item | Costo real |
|---|---|
| Upstash Redis (free tier) | $0 — cubre de sobra el tráfico de un portfolio |
| Vercel KV / marketplace | $0 en el tier gratis |
| Comandos post free-tier | irrelevante a este volumen |

**Costos NO monetarios (los que sí pesan):**
- +1 dependencia (otra cuenta, otra env var, otro punto de falla).
- +1 servicio que mantener/actualizar.
- Complejidad que hay que **poder explicar** si preguntan.

## Análisis de valor (proyecto de portfolio)

- **Necesidad técnica: baja.** Tráfico casi nulo; el riesgo real de brute-force
  distribuido en este contexto es mínimo y lo básico ya está cubierto.
- **Valor narrativo: alto pero condicional.** "Rate limiting distribuido + sesiones
  cacheadas en Redis serverless" es una buena historia de arquitectura (demuestra que
  entendés el stateless de serverless, el estado compartido, el cold-start). **Solo
  suma si lo podés defender** — el reclutador pregunta "¿por qué?", y ahí se gana o se
  pierde, no en haberlo enchufado.
- **Plot twist:** decidir **NO** hacerlo y documentarlo bien **ya es señal de
  criterio** ("lo dejé en el default con reglas estrictas + documenté el tradeoff y el
  upgrade path porque a escala de portfolio Redis es sobre-ingeniería"). Eso ya está
  escrito en `ARCHITECTURE.md` → "Redis para rate limit".

## Recomendación (para decidir después)

Depende del rol al que se apunte:

- **Full-stack / frontend-leaning → NO hacerlo.** El estado actual (rate limit activo +
  decisión documentada) cuenta una historia de *criterio* más valiosa que la
  integración. Ese tiempo rinde más en el core de producto (simulador, "disponible
  neto").
- **Backend / plataforma / infra → hacerlo, pero como pieza narrada.** Pasos 1-3 (1 h,
  $0) + 3 párrafos en README/ARCHITECTURE explicando el problema del estado compartido.
  El valor no es el código: es demostrar que entendés *el sistema*.

**Lo que NO conviene en ningún caso:** enchufarlo "porque sí", sin narrativa → sumás
complejidad sin sumar la señal.

## Links de referencia

- `docs/ARCHITECTURE.md` → sección "Mejora futura: Redis para rate limit (y caché de
  sesión)" — el porqué técnico detallado ya está ahí.
- `src/lib/auth.ts` → `rateLimit` — la mitigación actual (reglas por endpoint).
