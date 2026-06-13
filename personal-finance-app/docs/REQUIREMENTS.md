# REQUIREMENTS — CuotApp

Requerimientos funcionales y no funcionales del sistema. Sirve de referencia tanto para el desarrollo manual como para Claude Code al construir cada feature.

Convención de alcance (roadmap canónico en `docs/ROADMAP.md`):
- **(MVP)** → Fases 1-4 (auth, tarjetas, compras, cuotas, dashboard, calendario y **simulador**).
- **(Post-MVP)** → alertas, multi-moneda consolidada, OAuth, etc.
- La expansión de dominio a largo plazo (débito/efectivo, ingresos variables, préstamos,
  cuentas/saldos) está en la sección "Visión a futuro" de `ROADMAP.md`.

---

## Requerimientos funcionales

### RF-1. Autenticación y cuenta de usuario (MVP)

- **RF-1.1** El sistema debe permitir el registro mediante email + contraseña.
- **RF-1.2** El sistema debe permitir el inicio y cierre de sesión.
- **RF-1.3** Las contraseñas deben almacenarse hasheadas (responsabilidad de Better Auth).
- **RF-1.4** El sistema debe mantener sesión activa mediante cookie, con expiración razonable (default de Better Auth: 7 días).
- **RF-1.5** Todas las rutas de dashboard deben redirigir a `/login` si no hay sesión válida.
- **RF-1.6** Cada usuario debe poder configurar su **ingreso mensual** y su **moneda principal** (ARS o USD).
- **RF-1.7** *(Post-MVP)* Login con Google OAuth.
- **RF-1.8** *(Post-MVP)* Recuperación de contraseña por email.

### RF-2. Gestión de tarjetas (MVP)

- **RF-2.1** El usuario debe poder dar de alta una tarjeta indicando: nombre descriptivo, marca (Visa/Mastercard/Amex/Cabal/otro), últimos 4 dígitos (opcional), día de cierre, día de vencimiento, moneda.
- **RF-2.2** El usuario debe poder editar y desactivar (soft delete vía `isActive`) sus tarjetas. Una tarjeta desactivada conserva su historial pero no aparece en formularios de nueva compra.
- **RF-2.3** El usuario solo puede ver y operar sobre sus propias tarjetas (filtrado por `userId` de sesión en TODA query).
- **RF-2.4** El sistema NO debe permitir guardar el número completo de tarjeta (PCI-DSS); solo los últimos 4 dígitos.
- **RF-2.5** El día de cierre y vencimiento deben ser enteros entre 1 y 31, validados en cliente y servidor.

### RF-3. Registro de compras (MVP)

- **RF-3.1** El usuario debe poder registrar una compra indicando: tarjeta, descripción, monto total, cantidad de cuotas (1 a 24), fecha de compra, moneda, categoría (opcional), tasa de interés mensual (opcional), notas (opcional), comercio (opcional).
- **RF-3.2** Al crear la compra, el sistema debe generar automáticamente las N filas de `Installment` correspondientes, en una transacción atómica.
- **RF-3.3** El reparto de centavos debe ser exacto: la suma de las cuotas debe igualar el monto total al centavo. El resto se asigna a la última cuota.
- **RF-3.4** La fecha de vencimiento de cada cuota se calcula a partir del ciclo de la tarjeta (día de cierre + día de vencimiento) y la fecha de compra:
  - Si la compra es **el día del cierre o antes**, la primera cuota vence en el período del próximo vencimiento.
  - Si la compra es **después del cierre**, la primera cuota se desplaza un mes adicional.
- **RF-3.5** Si la compra tiene tasa de interés mensual, el monto de cada cuota debe contemplarla (sistema francés o tasa fija; decisión a documentar en `ARCHITECTURE.md`).
- **RF-3.6** El usuario debe poder editar campos descriptivos de una compra (descripción, categoría, notas) sin que esto recalcule las cuotas ya generadas.
- **RF-3.7** El usuario debe poder eliminar una compra; el sistema elimina en cascada todas sus cuotas asociadas (con confirmación previa).
- **RF-3.8** El usuario debe poder ver el listado de compras filtrable por tarjeta, mes, categoría y moneda.
- **RF-3.9** El usuario debe poder ver el detalle de una compra individual con todas sus cuotas y el estado de cada una.

### RF-4. Gestión de cuotas individuales (MVP)

- **RF-4.1** Cada cuota debe tener uno de tres estados: `PENDING`, `PAID`, `OVERDUE`.
- **RF-4.2** El usuario debe poder marcar manualmente una cuota como pagada, registrando la fecha de pago.
- **RF-4.3** El usuario debe poder revertir el estado "pagada" a pendiente (corrección de errores).
- **RF-4.4** El sistema debe marcar como `OVERDUE` las cuotas con fecha de vencimiento pasada y estado `PENDING` (puede resolverse con una query computada al leer, sin necesidad de cron).
- **RF-4.5** *(Post-MVP)* Editar el monto de una cuota individual (caso de refinanciación).

### RF-5. Dashboard principal (MVP)

- **RF-5.1** El dashboard debe mostrar para el **mes actual**, agrupado por moneda: total de cuotas comprometidas, ingreso configurado, disponible neto (ingreso − cuotas) y próximo vencimiento (fecha y monto).
- **RF-5.2** El dashboard debe mostrar la cantidad de cuotas vencidas (overdue) con badge de alerta.
- **RF-5.3** El dashboard debe poder navegarse mes a mes (anterior/siguiente).
- **RF-5.4** Si el usuario opera con dos monedas, los totales deben mostrarse separados (ARS y USD), nunca sumados.

### RF-6. Calendario de cuotas (MVP)

- **RF-6.1** El usuario debe poder ver una vista calendario con las cuotas agrupadas por fecha de vencimiento.
- **RF-6.2** Cada cuota mostrada debe indicar: monto, tarjeta, compra de origen, número de cuota (ej. "3/12").
- **RF-6.3** El calendario debe permitir navegar al menos 12 meses hacia adelante y 12 hacia atrás.
- **RF-6.4** Desde el calendario, hacer clic en una cuota debe llevar al detalle de su compra.

### RF-7. Categorías (MVP básico)

- **RF-7.1** El usuario debe poder crear, editar y eliminar categorías propias (ej. "Indumentaria", "Tecnología", "Supermercado").
- **RF-7.2** El sistema debe proveer un seed inicial de categorías comunes en español al crear la cuenta.
- **RF-7.3** *(MVP — adelantado a Fase 3)* Gráfico de gastos por categoría (donut en el dashboard).

### RF-8. Simulador de compras (MVP, Fase 4)

- **RF-8.1** El usuario debe poder ingresar un monto, una cantidad de cuotas y una tarjeta hipotéticos, sin persistir nada.
- **RF-8.2** El sistema debe mostrar el impacto mes a mes en el "disponible neto" futuro durante los meses afectados.
- **RF-8.3** El simulador debe poder comparar dos escenarios (ej. 6 cuotas sin interés vs 12 con interés).

### RF-9. Multi-moneda (parcial en MVP, completo en Post-MVP)

- **RF-9.1** *(MVP)* Cada tarjeta, compra y cuota debe llevar su moneda; el sistema nunca debe sumar montos de monedas distintas.
- **RF-9.2** *(Post-MVP)* El usuario debe poder cargar tipos de cambio históricos (modelo `ExchangeRate`) para visualizar totales consolidados en una moneda "display".

### RF-10. Alertas (Post-MVP)

- **RF-10.1** El dashboard debe mostrar un banner si hay cuotas con vencimiento en los próximos 3 días.
- **RF-10.2** *(Post-MVP futuro)* Notificaciones por email de vencimientos próximos.

---

## Requerimientos no funcionales

### RNF-1. Seguridad

- **RNF-1.1** Toda query a la base de datos debe filtrar por `userId` de la sesión activa. Un test automatizado debe validar que el usuario A no puede acceder a recursos del usuario B.
- **RNF-1.2** Toda Server Action debe validar sus inputs con Zod, aunque ya hayan sido validados en el cliente.
- **RNF-1.3** Las contraseñas deben hashearse con un algoritmo moderno (default de Better Auth).
- **RNF-1.4** Las cookies de sesión deben tener `httpOnly`, `secure` (en prod) y `sameSite: lax`.
- **RNF-1.5** Los secrets (DB URL, `BETTER_AUTH_SECRET`) nunca deben commitearse; deben vivir en `.env` (local) o en las *Environment Variables* de Vercel (prod).
- **RNF-1.6** El sistema no debe almacenar números completos de tarjeta de crédito.

### RNF-2. Precisión financiera

- **RNF-2.1** Todos los montos deben almacenarse como enteros en centavos, en columnas `bigint` de PostgreSQL.
- **RNF-2.2** Está prohibido el uso de `Float` / `double precision` para campos monetarios.
- **RNF-2.3** Las operaciones aritméticas sobre montos deben usar `BigInt` de JavaScript; las conversiones a `number` solo están permitidas en la capa de presentación, con `Intl.NumberFormat`.

### RNF-3. Performance

- **RNF-3.1** El Time To First Byte (TTFB) del dashboard debe ser menor a 500ms en condiciones normales.
- **RNF-3.2** Las queries de agregación de cuotas deben usar índices apropiados (`@@index([userId])`, `@@index([dueDate])`).
- **RNF-3.3** El bundle de JavaScript del cliente no debe superar los 250KB en compresión gzip para la página de dashboard.
- **RNF-3.4** El sistema debe aprovechar React Server Components: lectura de datos en el servidor por default, hidratación de cliente solo donde sea necesario.

### RNF-4. Disponibilidad y operación

- **RNF-4.1** La app debe estar disponible 24/7 con un uptime objetivo del 99% (margen aceptable para un proyecto de portfolio). Lo cubren los tiers gratuitos de Vercel (app) y Neon (Postgres).
- **RNF-4.2** Las migraciones de base de datos deben aplicarse mediante `prisma migrate deploy` como parte del deploy (Build Command de Vercel, contra `DIRECT_URL`); nunca `db push` en producción.
- **RNF-4.3** El sistema debe ser **configuración como código**: el entorno de desarrollo se reconstruye con `git clone && docker compose up`, y producción se reconstruye conectando el repo a Vercel + creando la base en Neon, con las variables de entorno documentadas en `ARCHITECTURE.md`.
- **RNF-4.4** Los backups de la base de datos los provee **Neon** (point-in-time restore en su tier); no se requiere implementación manual para el MVP.

### RNF-5. Calidad de código

- **RNF-5.1** TypeScript en modo estricto (`strict: true`); prohibido el uso de `any`.
- **RNF-5.2** Lint pasa sin warnings en CI antes de merge.
- **RNF-5.3** Conventional Commits para mensajes de commit.
- **RNF-5.4** Cobertura de tests unitarios mínima del 70% sobre la lógica de dominio (`src/server/lib/`).
- **RNF-5.5** Toda feature de dominio nueva debe tener al menos un test unitario que cubra su caso feliz y un caso borde.

### RNF-6. Testing

- **RNF-6.1** El proyecto debe tener tres niveles de testing: unit (Vitest), component (Vitest + React Testing Library) y E2E (Playwright).
- **RNF-6.2** El pipeline de CI debe correr `typecheck`, `lint`, `test` y `build` en cada push a `main` y en cada PR.
- **RNF-6.3** Debe existir al menos un test E2E que cubra el happy path completo: signup → login → crear tarjeta → registrar compra → ver calendario → marcar cuota pagada → logout.
- **RNF-6.4** La función `generateInstallments` debe estar cubierta con tests que validen redondeo de centavos, fechas de cierre y casos borde (1 cuota, 24 cuotas, compra el día del cierre).

### RNF-7. Usabilidad y accesibilidad

- **RNF-7.1** La interfaz debe estar en **español rioplatense** (mercado AR).
- **RNF-7.2** El sistema debe ser responsive (mobile-first); el caso de uso "consulto cuánto me queda este mes" se accede mayoritariamente desde el celular.
- **RNF-7.3** Los componentes interactivos deben cumplir con WAI-ARIA básico (cubierto por Radix UI bajo shadcn/ui).
- **RNF-7.4** Los formatos de fecha y moneda deben respetar el locale `es-AR` (separador de miles `.`, decimal `,`).
- **RNF-7.5** Todos los estados de la UI deben estar contemplados: loading (skeleton), empty state y error state.

### RNF-8. Mantenibilidad

- **RNF-8.1** Toda mutación pasa por una Server Action en `src/server/actions/`, nunca directamente desde un Client Component a Prisma.
- **RNF-8.2** El cliente de Prisma debe usarse mediante un único singleton importado desde `src/server/db/index.ts`.
- **RNF-8.3** La lógica de dominio pura (sin I/O) debe vivir en `src/server/lib/` y ser independiente de Next.js para facilitar tests.
- **RNF-8.4** Las decisiones técnicas no obvias deben documentarse en `docs/ARCHITECTURE.md` o en comentarios cuando sean locales.

### RNF-9. Documentación

- **RNF-9.1** El README debe permitir levantar el proyecto en menos de 10 minutos desde cero.
- **RNF-9.2** Debe existir un `.env.example` actualizado con todas las variables requeridas.
- **RNF-9.3** Los archivos `CLAUDE.md` y las reglas en `.claude/rules/` deben mantenerse actualizados con las convenciones vigentes.

### RNF-10. Deployment

- **RNF-10.1** El deploy de producción se hace en **Vercel** (plataforma serverless nativa de Next.js), con la base en **Neon**. El repo conectado a Vercel deploya `main` (producción) y cada PR (preview). *(El `Dockerfile` multi-stage standalone <400MB se conserva en el repo para la eventual migración a VPS; no lo usa el deploy actual.)*
- **RNF-10.2** El deploy debe ser idempotente (correrlo dos veces no rompe nada): `prisma migrate deploy` solo aplica las migraciones pendientes.
- **RNF-10.3** Las migraciones deben aplicarse automáticamente como parte del deploy, antes de servir la nueva versión: el Build Command de Vercel corre `prisma migrate deploy && next build`, y Vercel solo promueve el deploy si el build (con la migración) terminó OK.

---

## Trazabilidad (requerimiento → fase del roadmap)

Definición canónica de las fases en `docs/ROADMAP.md`. **MVP = Fases 1-4.**

| Fase | Requerimientos cubiertos |
|---|---|
| Fase 1 — Tarjetas | RF-1, RF-2 |
| Fase 2 — Core de cuotas | RF-3, RF-4, RF-7 |
| Fase 3 — Dashboard + calendario | RF-5, RF-6, RF-9.1, RF-7.3 (adelantado) |
| Fase 4 — Simulador (cierre del MVP) | RF-8 |
| Post-MVP | RF-1.7, RF-1.8, RF-4.5, RF-9.2, RF-10 |
| Fase 5 — Testing + CI/CD | RNF-5, RNF-6 |
| Fase 6 — Deploy | RNF-4, RNF-10 |
| Transversal (todas las fases) | RNF-1, RNF-2, RNF-3, RNF-7, RNF-8, RNF-9 |
