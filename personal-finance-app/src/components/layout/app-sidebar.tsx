"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CalendarDays,
  ChevronsUpDown,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Settings,
  ShoppingBag,
  Sparkles,
  Sun,
  Wallet,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tarjetas", label: "Tarjetas", icon: CreditCard },
  { href: "/compras", label: "Compras", icon: ShoppingBag },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/simulador", label: "Simulador", icon: Sparkles },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

type AppSidebarProps = {
  // DTO mínimo desde el layout (Server Component): solo strings serializables.
  user: { name: string; email: string };
};

/**
 * Navegación lateral de toda la app. Es Client Component porque necesita
 * `usePathname` (resaltar el ítem activo), `useTheme` y el sign-out del cliente.
 */
export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Las iniciales reemplazan al avatar (no manejamos imágenes de perfil).
  const initials =
    user.name
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  async function handleSignOut() {
    setIsSigningOut(true);
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                {/* shrink-0: sin esto el flex comprime el cuadro al colapsar el sidebar. */}
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Wallet className="size-4" />
                </div>
                {/* El texto de marca se oculta en modo icono (sidebar colapsado). */}
                <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="font-semibold tracking-tight">CuotApp</span>
                  {/* El sidebar es esmeralda: los secundarios usan su token. */}
                  <span className="text-sidebar-foreground/70 text-xs">
                    Cuotas bajo control
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                // startsWith cubre subrutas (ej. /compras/[id] mantiene activo "Compras").
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <div className="bg-sidebar-accent text-sidebar-accent-foreground flex size-8 items-center justify-center rounded-lg text-xs font-semibold">
                    {initials}
                  </div>
                  <div className="grid leading-tight">
                    <span className="truncate text-sm font-medium">{user.name}</span>
                    <span className="text-sidebar-foreground/70 truncate text-xs">
                      {user.email}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel>Tema</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                  <DropdownMenuRadioItem value="light">
                    <Sun className="size-4" /> Claro
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <Moon className="size-4" /> Oscuro
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <Monitor className="size-4" /> Sistema
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut} disabled={isSigningOut}>
                  <LogOut className="size-4" />
                  {isSigningOut ? "Saliendo…" : "Cerrar sesión"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
