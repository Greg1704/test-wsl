import { describe, it, expect } from "vitest";

import {
  completedSteps,
  pendingStep,
  shouldShowChecklist,
  type OnboardingFlags,
} from "./onboarding";

const flags = (
  hasIncome: boolean,
  hasCards: boolean,
  hasPurchases: boolean
): OnboardingFlags => ({ hasIncome, hasCards, hasPurchases });

describe("onboarding", () => {
  it("completedSteps cuenta los pasos hechos (0..3)", () => {
    expect(completedSteps(flags(false, false, false))).toBe(0);
    expect(completedSteps(flags(true, false, false))).toBe(1);
    expect(completedSteps(flags(true, true, false))).toBe(2);
    expect(completedSteps(flags(true, true, true))).toBe(3);
  });

  it("shouldShowChecklist: checklist con <2 pasos; dashboard con 2 o 3", () => {
    expect(shouldShowChecklist(flags(false, false, false))).toBe(true); // 0
    expect(shouldShowChecklist(flags(true, false, false))).toBe(true); // 1
    expect(shouldShowChecklist(flags(true, true, false))).toBe(false); // 2
    expect(shouldShowChecklist(flags(true, true, true))).toBe(false); // 3
  });

  it("pendingStep devuelve el faltante en orden canónico (ingreso→tarjeta→compra)", () => {
    expect(pendingStep(flags(false, false, false))).toBe("income");
    expect(pendingStep(flags(true, false, false))).toBe("cards");
    expect(pendingStep(flags(true, true, false))).toBe("purchases");
  });

  it("pendingStep es null cuando están los tres pasos", () => {
    expect(pendingStep(flags(true, true, true))).toBeNull();
  });

  it("con 2 de 3, pendingStep es exactamente el único que falta", () => {
    expect(pendingStep(flags(false, true, true))).toBe("income"); // falta ingreso
    expect(pendingStep(flags(true, true, false))).toBe("purchases"); // falta compra
  });
});
