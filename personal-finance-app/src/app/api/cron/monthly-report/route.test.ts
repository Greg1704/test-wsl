import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/server/db", () => ({
  prisma: { user: { findMany: vi.fn() } },
}));
vi.mock("@/server/queries/monthly-overview", () => ({
  getMonthlyOverviewForUser: vi.fn(),
}));
vi.mock("@/server/email/send", () => ({
  sendMonthlyReportEmail: vi.fn(),
}));

import { prisma } from "@/server/db";
import { getMonthlyOverviewForUser } from "@/server/queries/monthly-overview";
import { sendMonthlyReportEmail } from "@/server/email/send";
import { GET } from "./route";

const SECRET = "test-cron-secret";

function withDebt(committedCents: bigint) {
  return {
    defaultCurrency: "ARS",
    hasIncome: true,
    overdueCount: 0,
    currencies: [
      { currency: "ARS", committedCents, nextDue: null, incomeCents: null, netCents: null },
    ],
  };
}

function req(authHeader?: string): Request {
  return new Request("http://localhost/api/cron/monthly-report", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe("GET /api/cron/monthly-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
  });

  it("rechaza con 401 si falta el header Authorization", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(sendMonthlyReportEmail).not.toHaveBeenCalled();
  });

  it("rechaza con 401 si el bearer no coincide con CRON_SECRET", async () => {
    const res = await GET(req("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(sendMonthlyReportEmail).not.toHaveBeenCalled();
  });

  it("rechaza con 401 si CRON_SECRET no está configurado", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req("Bearer "));
    expect(res.status).toBe(401);
  });

  it("manda el mail solo a los usuarios con deuda en el mes", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "u1", email: "con-deuda@test.com" },
      { id: "u2", email: "sin-deuda@test.com" },
    ] as never);
    vi.mocked(getMonthlyOverviewForUser)
      .mockResolvedValueOnce(withDebt(50000n)) // u1 tiene deuda
      .mockResolvedValueOnce(withDebt(0n)); // u2 no
    vi.mocked(sendMonthlyReportEmail).mockResolvedValue(true);

    const res = await GET(req(`Bearer ${SECRET}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ processed: 2, sent: 1, skipped: 1, failed: 0 });
    expect(sendMonthlyReportEmail).toHaveBeenCalledTimes(1);
    expect(sendMonthlyReportEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "con-deuda@test.com" })
    );
  });

  it("cuenta como fallidos los envíos que Resend rechaza, sin abortar el lote", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "u1", email: "a@test.com" },
      { id: "u2", email: "b@test.com" },
    ] as never);
    vi.mocked(getMonthlyOverviewForUser).mockResolvedValue(withDebt(50000n));
    vi.mocked(sendMonthlyReportEmail).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const res = await GET(req(`Bearer ${SECRET}`));
    const body = await res.json();

    expect(body).toEqual({ processed: 2, sent: 1, skipped: 0, failed: 1 });
  });
});
