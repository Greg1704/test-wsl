# ROADMAP — CuotApp

**Fuente de verdad única** del alcance y las fases del proyecto. Si `SETUP.md`,
`REQUIREMENTS.md` o `PROXIMOS-PASOS.md` mencionan fases, se refieren a las definidas
acá. Ante cualquier discrepancia, **este archivo manda**.

> Distinción importante:
> - **Fases (1-6)** = el roadmap del producto (qué se construye y en qué orden).
> - **Pendientes operativos** (en `PROXIMOS-PASOS.md`) = tareas sueltas del día a día
>   (verificar la DB, dejar verde el E2E, etc.). NO son fases; no usar "Fase N" para ellos.

---

## Fases del roadmap

| Fase | Qué entrega | Requerimientos | Estado |
|---|---|---|---|
| **Fase 0** — Setup e infra | Auth, Docker, Prisma, testing base, layout | RF-1 | ✅ Hecho |
| **Fase 1** — Tarjetas | CRUD de tarjetas (alta/edición/soft delete), banco + color | RF-2 | ✅ Hecho |
| **Fase 2** — Core de cuotas | Registro de compras + generación de `Installment`, gestión de cuotas, categorías | RF-3, RF-4, RF-7 | ✅ Hecho |
| **Fase 3** — Dashboard + Calendario | "Disponible neto de cuotas" mes a mes, vista consolidada multi-tarjeta (proyección a 12 meses por tarjeta), calendario de vencimientos, gráfico por categoría | RF-5, RF-6, RF-9.1, RF-7.3 (adelantado) | ⏳ Pendiente |
| **Fase 4** — Simulador | Simulador previo a la compra ("si compro en N cuotas, así queda mi flujo futuro") | RF-8 | ⏳ Pendiente |

### 🏁 Frontera del MVP = Fases 1-4

El MVP entrega las **4 capacidades centrales** del producto (las de `CLAUDE.md`):
vista consolidada multi-tarjeta, disponible neto de cuotas, simulador de compras y
soporte ARS/USD. El **simulador es parte del MVP** porque es el diferencial frente a
la competencia, no un agregado posterior.

### Entrega (transversal al MVP)

| Fase | Qué entrega | Requerimientos |
|---|---|---|
| **Fase 5** — Testing + CI/CD | Cobertura de dominio, E2E del happy path, pipeline de GitHub Actions | RNF-5, RNF-6 |
| **Fase 6** — Deploy | Imagen Docker multi-stage + deploy a VPS | RNF-4, RNF-10 |

El testing es **continuo** (cada feature viene con sus tests, ver `.claude/rules/testing.md`);
la "Fase 5" es el momento de consolidar y montar el CI. La "Fase 6" es el lanzamiento.

---

## Post-MVP (mejoras sobre el mismo dominio de tarjetas/cuotas)

Una vez sólido el MVP, mejoras que **no cambian el dominio** (siguen siendo tarjetas
de crédito + cuotas), solo lo enriquecen:

- **Alertas** de vencimientos próximos (RF-10).
- **Multi-moneda consolidada**: tipos de cambio históricos para ver totales en una
  moneda "display" (RF-9.2).
- **OAuth con Google** y **recuperación de contraseña** (RF-1.7, RF-1.8).
- **Editar el monto de una cuota** individual / refinanciación (RF-4.5).
- ~~**Gráfico de gastos por categoría** (RF-7.3).~~ → **Adelantado a Fase 3** (donut
  de gasto mensual por categoría en el dashboard).

---

## Visión a futuro (expansión de dominio y público)

Dirección a largo plazo, **después** de un MVP sólido. El objetivo es pasar de un
**gestor de cuotas de tarjeta** a un **gestor de finanzas personales** más completo,
ampliando tanto los casos de uso como el público objetivo. Esto es una **visión de
alto nivel**: los requerimientos detallados se escribirán cuando se encare cada eje.

- **Débito / efectivo / transferencias.** Hoy el modelo solo entiende gastos en
  cuotas. Sumar gastos que no son en cuotas (un pago único en débito, efectivo, una
  transferencia) para reflejar el gasto real, no solo el financiado.
- **Ingresos variables.** Hoy el ingreso es un único monto fijo mensual
  (`User.monthlyIncomeCents`). Permitir registrar ingresos variables/extraordinarios
  para que el "disponible neto" sea más fiel.
- **Préstamos bancarios (sistema francés).** Hoy las cuotas usan "monto recargado en
  N cuotas iguales" (retail AR). Sumar amortización tipo sistema francés para modelar
  préstamos bancarios reales (ver nota en `ARCHITECTURE.md`).
- **Cuentas y saldos.** Hoy no se modela el dinero realmente disponible, solo el
  ingreso declarado menos las cuotas. Modelar cuentas/saldos daría una foto patrimonial
  real, no solo el compromiso de cuotas.

> Cada uno de estos ejes es una decisión de producto grande (toca el modelo de datos
> y amplía el público). Se evalúan de a uno, sin comprometer la simplicidad que hace
> bueno al MVP.
