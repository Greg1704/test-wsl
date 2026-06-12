import { describe, it, expect } from "vitest";

import { computeDisplayStatus } from "./installment-status";
import { InstallmentStatus } from "@/generated/prisma/client";

describe("computeDisplayStatus (RF-4.4)", () => {
  const today = new Date("2026-06-02");

  it("PENDING con vencimiento pasado ⇒ OVERDUE", () => {
    const result = computeDisplayStatus(InstallmentStatus.PENDING, new Date("2026-05-10"), today);
    expect(result).toBe(InstallmentStatus.OVERDUE);
  });

  it("PENDING con vencimiento futuro ⇒ sigue PENDING", () => {
    const result = computeDisplayStatus(InstallmentStatus.PENDING, new Date("2026-07-10"), today);
    expect(result).toBe(InstallmentStatus.PENDING);
  });

  it("borde: vence HOY ⇒ todavía PENDING (no vencida)", () => {
    const result = computeDisplayStatus(InstallmentStatus.PENDING, new Date("2026-06-02"), today);
    expect(result).toBe(InstallmentStatus.PENDING);
  });

  it("PAID nunca pasa a OVERDUE, aunque la fecha haya pasado", () => {
    const result = computeDisplayStatus(InstallmentStatus.PAID, new Date("2026-05-10"), today);
    expect(result).toBe(InstallmentStatus.PAID);
  });

  it("una cuota ya marcada OVERDUE se mantiene OVERDUE", () => {
    const result = computeDisplayStatus(InstallmentStatus.OVERDUE, new Date("2026-05-10"), today);
    expect(result).toBe(InstallmentStatus.OVERDUE);
  });

  it("ignora la hora del día (compara por día calendario)", () => {
    // dueDate al final del día de ayer, today a la mañana de hoy ⇒ OVERDUE.
    const result = computeDisplayStatus(
      InstallmentStatus.PENDING,
      new Date("2026-06-01T23:59:59"),
      new Date("2026-06-02T08:00:00")
    );
    expect(result).toBe(InstallmentStatus.OVERDUE);
  });

  // Regresión de zona horaria. Un `@db.Date` vuelve como medianoche UTC; "hoy" en
  // runtime es un Date con hora. Reproducimos ESE caso (el de arriba usa el mismo
  // instante para ambos, así que pasa en cualquier TZ y no lo cubre). Asume runtime
  // UTC, el invariante documentado en ARCHITECTURE ("Zona horaria del runtime"):
  // bajo una TZ negativa este assert falla a propósito y delata el desvío.
  it("borde TZ: dueDate UTC-midnight de hoy + now con hora ⇒ PENDING, no OVERDUE", () => {
    const dueDate = new Date("2026-06-09T00:00:00Z"); // como llega de @db.Date
    const now = new Date("2026-06-09T15:00:00Z"); // hoy a la tarde (UTC)
    expect(computeDisplayStatus(InstallmentStatus.PENDING, dueDate, now)).toBe(
      InstallmentStatus.PENDING
    );
  });
});
