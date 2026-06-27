import { Heading, Hr, Section, Text } from "@react-email/components";

import type { MonthlyReportContent } from "@/server/lib/monthly-report";
import { EmailLayout, styles } from "./layout";

/**
 * Mail mensual de deudas: por moneda, total comprometido del mes, ingreso, disponible
 * neto y próximo vencimiento. El contenido ya viene formateado (`buildMonthlyReport`).
 */
export function MonthlyReportEmail({ content }: { content: MonthlyReportContent }) {
  return (
    <EmailLayout preview={`Tus cuotas de ${content.monthLabel}`}>
      <Heading style={styles.heading}>Tus cuotas de {content.monthLabel}</Heading>
      <Text style={styles.text}>
        Este es el resumen de las cuotas que vencen este mes y cómo queda tu disponible
        neto, por moneda:
      </Text>

      {content.lines.map((line, i) => (
        <Section key={line.currency}>
          {i > 0 && <Hr style={{ borderColor: "#e4e4e7", margin: "16px 0" }} />}
          <Text style={row}>
            <strong>{line.currency}</strong>
          </Text>
          <Text style={row}>Cuotas del mes: {line.committed}</Text>
          {line.income && <Text style={row}>Ingreso: {line.income}</Text>}
          {line.net && (
            <Text style={{ ...row, color: line.netNegative ? "#dc2626" : "#16a34a" }}>
              Disponible neto: {line.net}
            </Text>
          )}
          {line.nextDue && (
            <Text style={row}>
              Próximo vencimiento: {line.nextDue.amount} el {line.nextDue.date}
            </Text>
          )}
        </Section>
      ))}

      <Text style={styles.muted}>
        Abrí CuotApp para ver el detalle por tarjeta y tu proyección de los próximos meses.
      </Text>
    </EmailLayout>
  );
}

const row: React.CSSProperties = {
  color: "#3f3f46",
  fontSize: "15px",
  lineHeight: "22px",
  margin: "0 0 4px",
};

export default MonthlyReportEmail;
