import { Wallet } from "lucide-react";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Primera impresión de la marca: fondo con halo esmeralda sutil + isologo.
    <div className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,_oklch(0.696_0.17_162.48_/_0.18),_transparent)]"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="bg-primary text-primary-foreground mx-auto mb-3 flex size-11 items-center justify-center rounded-xl shadow-sm">
            <Wallet className="size-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">CuotApp</h1>
          <p className="text-muted-foreground text-sm">
            Tus compras en cuotas, bajo control.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
