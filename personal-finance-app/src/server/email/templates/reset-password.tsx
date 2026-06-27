import { Button, Heading, Text } from "@react-email/components";

import { EmailLayout, styles } from "./layout";

/**
 * Mail de recuperación de contraseña: link de un solo uso a la página donde el
 * usuario elige una nueva contraseña. El token viaja en la `url` que arma Better Auth.
 */
export function ResetPasswordEmail({ url }: { url: string }) {
  return (
    <EmailLayout preview="Restablecé tu contraseña de CuotApp">
      <Heading style={styles.heading}>Restablecé tu contraseña</Heading>
      <Text style={styles.text}>
        Recibimos un pedido para restablecer la contraseña de tu cuenta. Hacé clic en el
        botón para elegir una nueva:
      </Text>
      <Button href={url} style={styles.button}>
        Restablecer contraseña
      </Button>
      <Text style={styles.muted}>
        El enlace vence en 1 hora y solo puede usarse una vez. Si no pediste este cambio,
        ignorá este mail: tu contraseña actual sigue siendo válida.
      </Text>
    </EmailLayout>
  );
}

export default ResetPasswordEmail;
