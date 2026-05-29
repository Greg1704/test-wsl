# Regla: Testing

El testing es el **diferencial de portfolio** de este proyecto (el autor viene de QA). Tratá los tests como ciudadanos de primera clase, no como un agregado.

## Herramientas

- **Vitest** — unit (lógica de dominio pura) y component (con React Testing Library).
- **Playwright** — E2E del flujo crítico. **No usar Selenium** en este proyecto.

## Prioridades (por ROI)

1. **Unit de lógica de dominio** (máxima prioridad): `generateInstallments`, helpers de `money.ts` y `dates.ts`. Apuntá a ~80% de cobertura acá. Incluí casos borde:
   - Redondeo de centavos (la suma de cuotas debe dar exacto el total).
   - Compra el día del cierre vs el día siguiente (cambia el primer vencimiento).
   - Compra en 1 sola cuota.
2. **E2E happy path** (alta prioridad para portfolio): signup → login → crear tarjeta → registrar compra en 6 cuotas → ver calendario → marcar cuota pagada → logout.
3. **Test de autorización**: el usuario A no puede acceder a recursos del usuario B.
4. **Component tests** (media prioridad): `<PurchaseForm>`, `<InstallmentCalendar>`, `<Simulator>`.

## Convenciones

- Archivos unit/component: junto al código, `*.test.ts(x)`.
- Archivos E2E: en `e2e/` o `tests/e2e/`, `*.spec.ts`.
- Cada feature nueva de dominio debe venir con al menos un test que la cubra.
- Antes de cerrar una tarea: `npm run typecheck && npm test`.
