import { createAuthClient } from "better-auth/react";

// Sin baseURL: la API de auth vive en este mismo Next (/api/auth/*), así que el
// cliente usa siempre el origen actual. Un baseURL absoluto (p. ej. localhost:3000)
// rompe cuando se entra por otro host: Docker (cuotapp:3000), IP de LAN, etc.
export const authClient = createAuthClient();

export const { signIn, signOut, signUp, useSession } = authClient;
