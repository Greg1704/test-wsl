"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { startDemoSession } from "@/server/actions/demo";
import { loginSchema, type LoginValues } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export default function LoginPage() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [isDemoPending, setIsDemoPending] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setIsPending(true);
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    setIsPending(false);

    if (error) {
      toast.error(error.message ?? "No pudimos iniciar sesión. Revisá tus datos.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  // Provisiona un sandbox demo y entra. La sesión queda seteada por la Server Action
  // (cookie vía nextCookies); acá solo redirigimos. Sembrar todo tarda ~1-2 s, por
  // eso el botón muestra su propio estado de carga.
  async function onDemo() {
    setIsDemoPending(true);
    try {
      await startDemoSession();
    } catch {
      setIsDemoPending(false);
      toast.error("No pudimos abrir el demo. Probá de nuevo en un momento.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="vos@email.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Contraseña</FormLabel>
                <Link
                  href="/forgot-password"
                  className="text-muted-foreground text-sm underline-offset-4 hover:underline"
                >
                  ¿La olvidaste?
                </Link>
              </div>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending || isDemoPending} className="w-full">
          {isPending ? "Ingresando…" : "Ingresar"}
        </Button>

        <div className="flex items-center gap-3">
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs">o</span>
          <span className="bg-border h-px flex-1" />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={onDemo}
          disabled={isPending || isDemoPending}
          className="w-full"
        >
          {isDemoPending ? "Preparando demo…" : "Probar demo (sin registro)"}
        </Button>

        <p className="text-muted-foreground text-center text-sm">
          ¿No tenés cuenta?{" "}
          <Link href="/signup" className="text-foreground underline underline-offset-4">
            Creá una
          </Link>
        </p>
      </form>
    </Form>
  );
}
