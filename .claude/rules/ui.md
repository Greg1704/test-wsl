# Regla: UI y formularios

## Alineación de campos en fila

Cuando hay **varios campos (inputs/selects) a la misma altura** en una fila
(layouts con `grid grid-cols-*` o `flex`), los controles deben quedar **alineados
arriba**, sin importar que uno muestre un mensaje de validación y otro no.

- Usá **`items-start`** en el contenedor de la fila.
- Motivo: el `FormItem` de shadcn es `grid gap-2` (label / control / mensaje). Con
  el `align-items: stretch` por defecto, cuando un campo agrega su `FormMessage` de
  error, su columna crece y estira a las demás, descolocando verticalmente los
  controles. `items-start` evita que las columnas se estiren: cada una toma su alto
  natural y el mensaje de error solo extiende su propia columna hacia abajo.

```tsx
// ✗ los controles se descolocan cuando uno muestra error
<div className="grid grid-cols-2 gap-4"> … </div>

// ✓ controles siempre alineados arriba
<div className="grid grid-cols-2 items-start gap-4"> … </div>
```

## Modales / dialogs de formulario

- Un dialog de formulario debe **abrir siempre limpio**: resetear valores, errores
  y estado auxiliar (paneles condicionales) en `onOpenChange` al abrir
  (`form.reset()` + reset de estados locales). El estado no debe sobrevivir entre
  aperturas.

## Selects (dropdown)

- El `SelectContent` usa **`position="popper"`** por defecto: el menú se ancla debajo
  del trigger, con altura acotada (`--radix-select-content-available-height`) y scroll.
  NO usar `item-aligned` (crece hacia arriba y tapa la pantalla con listas largas, ej.
  días 1-31). El cambio está en el componente base, así aplica a todos los selects.

## Filtros de entrada

- Restringí lo que se puede tipear en el `onChange`, además de validar con Zod:
  - Campos numéricos (ej. últimos 4 dígitos): `value.replace(/\D/g, "")`.
  - Campos de solo texto (ej. nombre de persona): `value.replace(/[^\p{L}\s]/gu, "")`.
- La validación Zod es el respaldo del server; el filtro en el input es UX.

## Campos numéricos que se pueden vaciar (bug recurrente de RHF)

En un input numérico controlado por react-hook-form (`FormField`/`Controller`) que tiene
un `defaultValue` (típico en **modo edición**, con el valor prefilled), el vacío debe
representarse con **`null`, NO con `undefined`**.

- Con `undefined`, el `Controller` de RHF **vuelve a caer en el `defaultValue`** y
  "reinserta" el valor original justo cuando terminás de borrarlo (parece que el campo se
  regenera solo).
- Patrón correcto:

```tsx
// default: null para el vacío (casteado si el tipo Zod es number)
amount: edit?.amountValue ?? (null as unknown as number),

// onChange: vacío ⇒ null (no undefined)
value={field.value ?? ""}
onChange={(e) =>
  field.onChange(e.target.value === "" ? (null as unknown as number) : e.target.valueAsNumber)
}
```

- Zod rechaza `null` en un `z.number()`, así que el campo sigue marcando error si queda
  vacío (el `null` es solo el estado intermedio de edición, no un valor válido).
- Ejemplos en el repo: `creditLimit` en `card-form-dialog.tsx`, `amount` en
  `subscription-form-dialog.tsx`.

## General

- Preferí componentes de **shadcn/ui** antes de escribir CSS a mano (ver CLAUDE.md).
