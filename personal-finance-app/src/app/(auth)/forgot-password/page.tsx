"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "@/lib/validation/auth";
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

export default function ForgotPasswordPage() {
  const [isPending, setIsPending] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setIsPending(true);
    // redirectTo: a dónde lleva el link del mail (Better Auth le agrega ?token=...).
    const { error } = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: "/reset-password",
    });
    setIsPending(false);

    if (error) {
      toast.error("No pudimos procesar el pedido. Probá de nuevo en un momento.");
      return;
    }
    // Mensaje neutro: no revelamos si el email existe o no (no enumerar cuentas).
    setSent(true);
  }

  if (sent) {
    return (
      <div className="grid gap-4 text-center">
        <p className="text-sm">
          Si hay una cuenta con ese email, te enviamos un enlace para restablecer la
          contraseña. Revisá tu casilla (y la carpeta de spam).
        </p>
        <Link
          href="/login"
          className="text-foreground text-sm underline underline-offset-4"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <p className="text-muted-foreground text-sm">
          Ingresá tu email y te enviamos un enlace para crear una nueva contraseña.
        </p>
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
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Enviando…" : "Enviar enlace"}
        </Button>
        <p className="text-muted-foreground text-center text-sm">
          <Link href="/login" className="text-foreground underline underline-offset-4">
            Volver al inicio de sesión
          </Link>
        </p>
      </form>
    </Form>
  );
}
