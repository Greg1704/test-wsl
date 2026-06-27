"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import {
  resetPasswordSchema,
  type ResetPasswordValues,
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

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Better Auth arma el link del mail con ?token=...; si el token es inválido o venció,
  // redirige acá con ?error=INVALID_TOKEN en vez del token.
  const token = searchParams.get("token");
  const linkError = searchParams.get("error");
  const [isPending, setIsPending] = useState(false);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "" },
  });

  async function onSubmit(values: ResetPasswordValues) {
    if (!token) return;
    setIsPending(true);
    const { error } = await authClient.resetPassword({
      newPassword: values.password,
      token,
    });
    setIsPending(false);

    if (error) {
      toast.error(
        "No pudimos restablecer la contraseña. El enlace pudo haber vencido; pedí uno nuevo."
      );
      return;
    }

    toast.success("Contraseña actualizada. Ya podés iniciar sesión.");
    router.push("/login");
  }

  // Sin token válido en el link no hay nada que hacer: ofrecemos pedir otro.
  if (!token || linkError) {
    return (
      <div className="grid gap-4 text-center">
        <p className="text-sm">
          El enlace no es válido o venció. Pedí uno nuevo para restablecer tu contraseña.
        </p>
        <Link
          href="/forgot-password"
          className="text-foreground text-sm underline underline-offset-4"
        >
          Pedir un nuevo enlace
        </Link>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <p className="text-muted-foreground text-sm">
          Elegí una nueva contraseña para tu cuenta.
        </p>
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nueva contraseña</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Guardando…" : "Restablecer contraseña"}
        </Button>
      </form>
    </Form>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams requiere un límite de Suspense para no romper el render estático.
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
