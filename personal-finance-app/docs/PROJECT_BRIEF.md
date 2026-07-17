# CuotApp — Documento técnico de referencia

## 1. Qué problema resuelve

CuotApp es una app de finanzas personales enfocada en el mercado argentino, donde el gasto en cuotas con tarjeta de crédito es la forma dominante de financiar compras. Los bancos y billeteras muestran el resumen mes a mes, pero nadie da una **vista consolidada hacia adelante**: cuánto de tu ingreso futuro ya está comprometido, sumando todas tus tarjetas, mes por mes. Ese es el vacío que cubre CuotApp.

Es un proyecto de portfolio personal, desarrollado para hacer la transición de un rol de QA a uno full stack — por eso el testing y la calidad de código son un eje declarado del proyecto, no un detalle secundario.

## 2. Alcance funcional (estado actual, en producción)

**Núcleo (MVP original, Fases 1-4):**
- Autenticación con email/contraseña (Better Auth), sesión por cookie.
- Alta y gestión de tarjetas (nombre, marca, últimos 4 dígitos, día de cierre/vencimiento, moneda). Nunca se guarda el número completo (PCI-DSS).
- Registro de compras en cuotas: la app calcula automáticamente en qué resumen cae la compra y genera las N cuotas con sus fechas de vencimiento reales.
- Gestión de cuotas individuales: marcar pagada/pendiente, detección de vencidas.
- Dashboard con ingreso, cuotas comprometidas y "disponible neto" del mes, navegable mes a mes.
- Calendario de vencimientos.
- Categorías de gasto con gráfico de distribución.
- Simulador: "si compro esto en N cuotas, así impacta mi flujo futuro", con comparación de escenarios.

**Extensiones post-MVP ya implementadas (evolución del producto más allá del alcance inicial):**
- Tarjetas multi-moneda reales: un mismo plástico puede operar en ARS y USD bajo el mismo ciclo de cierre/vencimiento, y la compra elige la moneda (no la tarjeta).
- Compra con recargo del comercio ("N cuotas de $X" en vez de tasa): el sistema deriva la tasa mensual implícita (TEM) resolviendo por bisección con sistema francés.
- Seguimiento de límite de crédito y % de utilización por tarjeta (opt-in), con conversión de moneda mediante cotización *snapshot* al momento de la compra.
- Eje de ahorro: medios de pago no-crédito (débito/transferencia/efectivo) y un motor que computa el saldo disponible mes a mes desde un punto de anclaje declarado por el usuario, sin materializar un balance mutable.
- Suscripciones / gastos recurrentes (Netflix, Spotify, etc.): modelo híbrido definición + excepciones puntuales, sin cron job, integrado al calendario, a la utilización de crédito y al ahorro.

## 3. Modelo de datos (resumen)

Entidades centrales: `User`, `Card`, `Purchase`, `Installment` (cuota individual, materializada — no calculada al vuelo), `Category`, `Subscription`/`SubscriptionCharge`, `SavingsBalance`, `ExchangeRate`. Todo filtrado siempre por `userId` de sesión.

## 4. Decisiones técnicas destacadas (buen material para mostrar profundidad)

- **Dinero como enteros en centavos (`BigInt`), nunca floats.** El reparto de una compra en N cuotas usa una regla de redondeo que garantiza que la suma cierre exacta al centavo, repartiendo el resto entre las primeras cuotas.
- **Cálculo de ciclo de cuotas:** determinar en qué cierre cae una compra y cuándo vence la primera cuota, a partir del día de cierre/vencimiento de cada tarjeta, con ajuste a día hábil si el vencimiento cae fin de semana.
- **Invariante de zona horaria (runtime en UTC):** decisión documentada y blindada con tests, para evitar corrimientos de fecha de ±1 día en fechas de calendario sin hora.
- **Tasa de interés derivada, no ingresada:** el usuario carga el total financiado (como lo ve en la caja), y el sistema deriva la tasa mensual implícita — evita pedirle al usuario un dato que en la práctica nadie tiene.
- **Ahorro como valor computado, no columna mutable:** se recalcula desde un ancla temporal (instante, no fecha) para evitar doble conteo cuando el usuario re-ancla el mismo día que paga una cuota.
- **Server Actions tratadas como endpoints públicos:** toda mutación valida con Zod en el servidor y filtra por `userId` de sesión, sin confiar en la validación del cliente.

## 5. Stack técnico y motivo de cada elección

| Herramienta | Rol | Por qué se eligió |
|---|---|---|
| **Next.js (App Router)** | Framework full stack | Permite tener backend y frontend en un solo repo/deploy: Server Components y Server Actions hacen de "backend", sin mantener una API separada. Encaja con el modelo serverless de Vercel. |
| **TypeScript (modo estricto)** | Tipado | Evita errores de tipo en tiempo de compilación; en un dominio financiero (montos, monedas, fechas) el tipado estricto atrapa clases enteras de bugs antes de que lleguen a producción. `any` prohibido. |
| **Prisma ORM + PostgreSQL** | Persistencia | Prisma da tipado end-to-end sobre el schema de la base y migraciones versionadas. PostgreSQL soporta bien tipos `bigint`/`decimal` exactos, necesarios para no perder precisión en montos. |
| **Better Auth** | Autenticación | Librería de auth moderna para Next.js, con adapter directo para Prisma; maneja hasheo de contraseñas y sesión por cookie sin reinventar la rueda en un componente sensible a seguridad. |
| **Tailwind v4 + shadcn/ui (Radix)** | UI | shadcn/ui da componentes accesibles (WAI-ARIA vía Radix) y personalizables por composición, no una librería cerrada — permite mantener consistencia visual sin escribir CSS a mano en cada feature. |
| **Zod** | Validación | Un mismo schema valida en cliente y servidor, con tipos TypeScript inferidos automáticamente — evita duplicar reglas de validación. |
| **react-hook-form** | Formularios | Manejo de formularios performante (sin re-render por cada tecla) integrado de forma directa con Zod para la validación. |
| **date-fns** | Fechas | Manipulación de fechas inmutable y con funciones puras, más liviana que alternativas como Moment.js, suficiente para el manejo de fechas de calendario que necesita el dominio. |
| **Vitest** | Testing unitario/componente | Tests rápidos (integración nativa con Vite) para la lógica de dominio pura (cálculo de cuotas, dinero, fechas) y componentes con React Testing Library. |
| **Playwright** | Testing E2E | Cobertura del flujo crítico completo (registro → login → alta de tarjeta → compra en cuotas → calendario → marcar pagada → logout) simulando un navegador real. |
| **Docker + docker-compose** | Entorno de desarrollo | Levanta PostgreSQL local con un solo comando y da paridad de entorno entre desarrolladores, sin instalar Postgres nativo. Solo se usa en desarrollo. |
| **Vercel** | Hosting/deploy (producción) | Plataforma nativa de Next.js: build, HTTPS, deploy preview por cada PR y funciones serverless sin gestionar infraestructura — costo $0 en tier gratuito, ideal para un proyecto de portfolio. |
| **Neon** | Base de datos (producción) | PostgreSQL serverless administrado, con *point-in-time restore* y un endpoint *pooled* pensado para el patrón de muchas conexiones cortas que generan las funciones serverless de Vercel. |
| **GitHub Actions** | CI | Portón de calidad (typecheck, lint, test, build) en cada push/PR, separado del pipeline de deploy que maneja Vercel automáticamente. |

## 6. Testing y calidad (diferencial declarado del proyecto)

- Lógica de dominio pura (`generateInstallments`, cálculo de dinero, fechas, ahorro) con ~80% de cobertura y casos borde explícitos: redondeo de centavos, compra el día del cierre vs. el día siguiente, 1 sola cuota, meses cortos.
- Test de autorización: el usuario A no puede acceder a recursos del usuario B.
- E2E del flujo crítico completo con Playwright.
- CI corre typecheck + lint + test + build en cada push/PR a `main`.

## 7. Deployment

Arquitectura serverless: Next.js en Vercel (Server Components/Server Actions como funciones efímeras) + PostgreSQL en Neon, con migraciones aplicadas automáticamente antes de cada deploy (`prisma migrate deploy && next build`). Entorno de desarrollo reproducible con Docker Compose (`git clone && docker compose up`).
