import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/server/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      defaultCurrency: {
        type: "string",
        defaultValue: "ARS",
      },
      monthlyIncomeCents: {
        type: "number",
        defaultValue: 0,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
