import {
  ShoppingBag,
  Utensils,
  Car,
  Home,
  Plane,
  Gift,
  Heart,
  Smartphone,
  Shirt,
  Stethoscope,
  GraduationCap,
  Dumbbell,
  Film,
  Wrench,
  Fuel,
  PiggyBank,
  type LucideIcon,
} from "lucide-react";

/**
 * Presets para categorías de gasto. El color se guarda como hex y el ícono como
 * el **nombre** de un ícono de lucide (`Category.icon`), que se resuelve a su
 * componente con `CATEGORY_ICONS`. Mantener el set acotado: es un selector, no un
 * picker libre (más simple de testear y de mostrar consistente en toda la app).
 */
export const CATEGORY_COLORS = [
  "#ef4444", // rojo
  "#f97316", // naranja
  "#eab308", // amarillo
  "#22c55e", // verde
  "#06b6d4", // cian
  "#3b82f6", // azul
  "#8b5cf6", // violeta
  "#ec4899", // rosa
] as const;

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  ShoppingBag,
  Utensils,
  Car,
  Home,
  Plane,
  Gift,
  Heart,
  Smartphone,
  Shirt,
  Stethoscope,
  GraduationCap,
  Dumbbell,
  Film,
  Wrench,
  Fuel,
  PiggyBank,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

/** Devuelve el componente de ícono para un nombre guardado, o null si no aplica. */
export function categoryIcon(name?: string | null): LucideIcon | null {
  if (!name) return null;
  return CATEGORY_ICONS[name] ?? null;
}
