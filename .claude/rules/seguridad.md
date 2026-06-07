# Regla: Seguridad

- **Autorización en TODA query.** Filtrá siempre por el `userId` de la sesión. El usuario A nunca debe poder leer/editar datos del usuario B. Obtené el usuario desde la sesión de Better Auth, no de parámetros del cliente.
- **Validá en el server, siempre.** Las Server Actions son endpoints públicos disfrazados. Validá los inputs con Zod aunque ya valides en el cliente.
- **Datos de tarjeta:** guardá únicamente los **últimos 4 dígitos** (`last4`) y el **vencimiento como MM/AA** (`expirationDate`, fin del mes). Nunca el **PAN completo**, el **CVV** ni el **PIN** (PCI-DSS). El MM/AA por sí solo —sin PAN ni CVV— no permite transaccionar; lo guardamos porque habilita la sección de tarjetas **vencidas** y el flujo de **renovación** (avisar/proyectar cuándo una tarjeta deja de servir). Es el mínimo necesario para esas features, nada más.
- **Secrets:** van en `.env` (gitignored) en local y en GitHub Secrets / `.env` del VPS en deploy. Incluí siempre un `.env.example` sin valores reales. Nunca hardcodees secrets.
- **Better Auth:** mantené la dependencia en la última patch (ha tenido advisories de seguridad). `BETTER_AUTH_SECRET` debe ser aleatorio y largo (`openssl rand -base64 32`).
- No loguees datos sensibles (tokens, montos asociados a personas) en producción.
