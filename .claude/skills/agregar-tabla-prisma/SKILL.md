---
name: agregar-tabla-prisma
description: Usar cuando haya que agregar un modelo nuevo, modificar uno existente o crear una migración en Prisma dentro de CuotApp. Cubre las convenciones del schema (BigInt para dinero, Date para fechas, índices por userId), el flujo de migración correcto y los errores típicos. Disparar ante pedidos como "agregá una tabla de X", "modificá el modelo Y", "necesito un campo nuevo en Z", "creá una migración".
---

# Skill: Agregar o modificar una tabla en Prisma

## Convenciones obligatorias del schema

- **IDs:** `String @id @default(cuid())`.
- **Dinero:** `BigInt` (centavos). Nunca `Float`. Para tasas/ratios podés usar `Decimal @db.Decimal(p, s)`.
- **Fechas de calendario** (vencimientos, fecha de compra): `DateTime @db.Date`. Timestamps de sistema: `DateTime @default(now())` / `@updatedAt`.
- **Relación con usuario:** todo modelo de dominio lleva `userId String`, su relación `@relation(... onDelete: Cascade)` y `@@index([userId])`.
- **Estados:** usá `enum` (ej. `InstallmentStatus`) en vez de strings sueltos.
- Nombres de modelo en **PascalCase singular** (`Purchase`, no `purchases`).

## Flujo de migración

```bash
# 1. Editá prisma/schema.prisma
# 2. Generá la migración (nombre descriptivo en snake_case)
npx prisma migrate dev --name add_<algo>
# 3. Regenerá el cliente (suele correr solo, pero por las dudas)
npx prisma generate
# 4. Verificá visualmente
npx prisma studio
```

- Los archivos de `prisma/migrations/` **se commitean**.
- En CI/producción se usa `npx prisma migrate deploy` (nunca `db push`).

## Errores típicos a evitar

- Olvidar el `@@index([userId])` → queries lentas y olvido de filtrar por usuario.
- Usar `Float` para dinero → bug de redondeo garantizado.
- Cambiar un campo a `required` sin default sobre una tabla con datos → la migración falla; agregá `@default(...)` o hacelo en dos pasos.
- Olvidar `npx prisma generate` tras el cambio → tipos desactualizados en TS.

## Después de migrar

- Actualizá `docs/ARCHITECTURE.md` si el cambio afecta el modelo de datos documentado.
- Si el modelo nuevo participa de cálculos, seguí la skill `crear-feature-cuotas`.
