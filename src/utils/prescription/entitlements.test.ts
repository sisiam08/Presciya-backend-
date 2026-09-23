import { describe, it, expect } from "vitest";
import { formatDosage } from "./dosage";
import { buildPrescriptionViewModel } from "./view-model";

/**
 * The dosage rule previously lived in the frontend only, so the printed
 * document disagreed with the UI. It now has ONE implementation, shared by the
 * UI path and every template/PDF — these cases lock the exact contract.
 */
describe("formatDosage — canonical presentation rule", () => {
  it("drops ONLY a trailing fourth position that is exactly 0", () => {
    expect(formatDosage("1+1+1+0")).toBe("1+1+1");
    expect(formatDosage("1+0+1+0")).toBe("1+0+1");
    expect(formatDosage("1+1+0+0")).toBe("1+1+0");
    expect(formatDosage("1+0+0+0")).toBe("1+0+0");
    expect(formatDosage("0+0+0+0")).toBe("0+0+0");
  });

  it("leaves the pattern untouched when the last position is non-zero", () => {
    expect(formatDosage("1+1+1+1")).toBe("1+1+1+1");
    expect(formatDosage("0+0+0+1")).toBe("0+0+0+1");
    expect(formatDosage("1+0+0+1")).toBe("1+0+0+1");
  });

  it("never removes middle/first/second/third zeros", () => {
    expect(formatDosage("0+1+0+0")).toBe("0+1+0");
    expect(formatDosage("1+0+0+0")).toBe("1+0+0");
  });

  it("passes through anything that is not a four-position pattern", () => {
    expect(formatDosage("1+0+1")).toBe("1+0+1");
    expect(formatDosage("As needed")).toBe("As needed");
    expect(formatDosage("")).toBe("");
    expect(formatDosage(null)).toBe("");
    expect(formatDosage(undefined)).toBe("");
  });
});

const baseRenderData = {
  id: "test-id",
  status: "FINALIZED",
  language: "ENGLISH",
  template: "DEFAULT",
  createdAt: new Date(),
  verificationCode: "verify-code",
  doctor: {
    name: "Dr Test",
    qualification: "",
    specialization: "",
    registrationNo: "",
    signature: "",
    bmdcApproved: false,
  },
  chamber: null,
  patient: {
    name: "Patient",
    age: 30,
    gender: "MALE",
    phone: "",
    bloodGroup: "",
    allergies: "",
    chronicDiseases: "",
  },
  medicines: [],
} as any;

describe("view model — plan-entitlement driven output", () => {
  it("generates a QR when qr_verification is allowed (default)", () => {
    const vm = buildPrescriptionViewModel({ ...baseRenderData } as any);
    expect(vm.qrCodeUrl).toContain("create-qr-code");
  });

  it("does NOT generate a QR when the entitlement is explicitly denied", () => {
    const vm = buildPrescriptionViewModel({
      ...baseRenderData,
      qrVerificationAllowed: false,
    } as any);
    expect(vm.qrCodeUrl).toBe("");
  });

  it("applies the dosage rule to the rendered medicine line", () => {
    const vm = buildPrescriptionViewModel({
      ...baseRenderData,
      medicines: [
        {
          brandName: "Napa",
          generic: "Paracetamol",
          strength: "500 mg",
          type: "Tablet",
          usageType: "DAILY",
          dosagePattern: "1+1+1+0",
          duration: "7 days",
        },
      ],
    } as any);
    expect(vm.medicines[0]?.dosage).toBe("1+1+1");
  });
});
