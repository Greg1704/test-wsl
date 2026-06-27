import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

/**
 * Layout base de los mails de CuotApp (React Email). Centraliza el `<Html>`/`<Body>`,
 * los estilos compartidos y el pie, para que cada template solo aporte su contenido.
 * Los estilos van inline (objetos de estilo): los clientes de mail no soportan CSS
 * externo ni la mayoría de las hojas de estilo, así que React Email los emite inline.
 */
export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section>
            <Text style={brand}>CuotApp</Text>
          </Section>
          {children}
          <Hr style={hr} />
          <Text style={footer}>
            CuotApp — tus compras en cuotas, bajo control. Si no esperabas este mail,
            podés ignorarlo.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#f4f4f5",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  padding: "24px 0",
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "32px",
};

const brand: React.CSSProperties = {
  color: "#4f46e5",
  fontSize: "20px",
  fontWeight: 700,
  margin: "0 0 8px",
};

const hr: React.CSSProperties = {
  borderColor: "#e4e4e7",
  margin: "24px 0",
};

const footer: React.CSSProperties = {
  color: "#71717a",
  fontSize: "12px",
  lineHeight: "18px",
  margin: 0,
};

/** Estilos reutilizables por los templates concretos. */
export const styles = {
  heading: {
    color: "#18181b",
    fontSize: "22px",
    fontWeight: 700,
    margin: "0 0 16px",
  } satisfies React.CSSProperties,
  text: {
    color: "#3f3f46",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 16px",
  } satisfies React.CSSProperties,
  button: {
    backgroundColor: "#4f46e5",
    borderRadius: "6px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: 600,
    padding: "12px 24px",
    textDecoration: "none",
  } satisfies React.CSSProperties,
  muted: {
    color: "#71717a",
    fontSize: "13px",
    lineHeight: "20px",
    margin: "16px 0 0",
  } satisfies React.CSSProperties,
};
