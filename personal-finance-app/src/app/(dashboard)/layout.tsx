import { requireUser } from "@/server/auth/session";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Garantiza sesión en todo el grupo (dashboard); si no hay, redirige a /login.
  const user = await requireUser();

  return (
    <SidebarProvider>
      {/* Al sidebar (Client Component) le pasamos solo strings serializables. */}
      <AppSidebar
        user={{ name: user.name?.trim() || user.email, email: user.email }}
      />
      {/* SidebarInset es el <main> de la página; las pages usan <div> como raíz. */}
      <SidebarInset>
        <header className="bg-background/80 sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
          <SidebarTrigger />
          <Separator orientation="vertical" className="!h-4" />
          <span className="text-muted-foreground text-sm">CuotApp</span>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
