export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
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
