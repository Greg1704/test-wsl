import Link from "next/link";

import { pendingStep, type OnboardingFlags, type OnboardingStep } from "@/server/lib/onboarding";
import { Button } from "@/components/ui/button";

const STEP_BANNER: Record<OnboardingStep, { text: string; cta: string; href: string }> = {
  income: {
    text: "Configurá tu ingreso mensual para ver el disponible neto.",
    cta: "Configurar ingreso",
    href: "/configuracion",
  },
  cards: {
    text: "Agregá una tarjeta para registrar tus compras.",
    cta: "Agregar tarjeta",
    href: "/tarjetas",
  },
  purchases: {
    text: "Registrá tu primera compra para ver tus cuotas.",
    cta: "Registrar compra",
    href: "/compras",
  },
};

/**
 * Banner del dashboard que empuja al único paso de alta que falta (el recuadro
 * punteado generalizado: ingreso, tarjeta o compra). No renderiza nada si ya están
 * los tres pasos. Server Component.
 */
export function NextStepBanner({ flags }: { flags: OnboardingFlags }) {
  const step = pendingStep(flags);
  if (!step) return null;
  const banner = STEP_BANNER[step];

  return (
    <div className="border-primary/35 bg-primary/5 flex items-center justify-between gap-3 rounded-xl border border-dashed p-4">
      <p className="text-muted-foreground text-sm">{banner.text}</p>
      <Button asChild size="sm">
        <Link href={banner.href}>{banner.cta}</Link>
      </Button>
    </div>
  );
}
