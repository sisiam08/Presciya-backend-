import { describe, it, expect } from "vitest";
import { generatePrescriptionHtml } from "./index";
import { buildPrescriptionViewModel } from "./view-model";
import { IPdfRenderData } from "../../interface/pdf.type";

const baseData = (overrides: Partial<IPdfRenderData> = {}): IPdfRenderData => ({
  id: "rx-1",
  serialNumber: "PRS-ABCD-000001",
  createdAt: new Date("2026-01-01T10:00:00Z"),
  status: "FINALIZED",
  complaints: "Fever",
  diagnosis: "Viral fever",
  clinicalNotes: "Drink plenty of water",
  advises: "Rest well",
  nextVisitDate: new Date("2026-01-08T10:00:00Z"),
  medicines: [],
  doctor: {
    name: "Karim",
    qualification: "MBBS",
    specialization: "Medicine",
    registrationNo: "A-123456",
    signature: null,
    bmdcApproved: true,
  },
  chamber: {
    chamberName: "Test Chamber",
    chamberAddress: "Dhaka",
    chamberEmail: "c@example.com",
    logo: null,
    chamberSlogan: "Care",
    templateConfig: { colorTheme: "#0f8374", showLogo: true },
    chamberPhone: [{ phone: "01700000000" }],
  },
  patient: {
    name: "Rahim",
    age: 30,
    gender: "MALE",
    phone: "01711111111",
    bloodGroup: "O+",
    allergies: "Penicillin",
    chronicDiseases: "None",
    patientIdentifier: "P-0001",
  },
  ...overrides,
});

// A raw PrescriptionMedicine-shaped row (snapshot* columns) as returned by
// Prisma — the renderer must still show the medicine name.
const snapshotMedicine = (i: number) => ({
  snapshotBrandName: `Napa ${i}`,
  snapshotGeneric: "Paracetamol",
  snapshotStrength: "500mg",
  snapshotType: "Tablet",
  usageType: "DAILY",
  dosagePattern: "1+0+1",
  mealTiming: "AFTER_MEAL",
  duration: "7 days",
  instruction: "Take with water",
});

const TEMPLATES = [
  "DEFAULT",
  "MODERN_CLINICAL",
  "MINIMAL_PROFESSIONAL",
  "MODERN_MEDICAL",
  "ELEGANT_COMPACT",
];

describe("prescription rendering — medicine name bug (root cause)", () => {
  it("renders brand, generic and strength from snapshot* medicine columns", () => {
    const html = generatePrescriptionHtml(
      baseData({ medicines: [snapshotMedicine(1)] }),
    );
    expect(html).toContain("Napa 1");
    expect(html).toContain("Paracetamol");
    expect(html).toContain("500mg");
  });

  it("renders every medicine line for multiple medicines", () => {
    const medicines = Array.from({ length: 6 }, (_, i) => snapshotMedicine(i + 1));
    const html = generatePrescriptionHtml(baseData({ medicines }));
    for (let i = 1; i <= 6; i++) expect(html).toContain(`Napa ${i}`);
  });
});

describe("prescription rendering — language", () => {
  const banglaData = () =>
    baseData({
      language: "BANGLA",
      medicines: [snapshotMedicine(1)],
    });

  it("English uses English meal timing and section labels", () => {
    const html = generatePrescriptionHtml(
      baseData({ language: "ENGLISH", medicines: [snapshotMedicine(1)] }),
    );
    expect(html).toContain("After Meal");
    expect(html).toContain("Next Visit");
  });

  it("Bangla translates meal timing and the four language-aware labels", () => {
    const html = generatePrescriptionHtml(banglaData());
    expect(html).toContain("খাবার পরে"); // After Meal
    expect(html).toContain("পরামর্শ"); // Advice
    expect(html).toContain("পরবর্তী সাক্ষাৎ"); // Next Visit
    expect(html).toContain("নির্দেশনা"); // Instructions
    expect(html).not.toContain("After Meal");
  });

  it("Bangla does NOT translate proper nouns, medicine or dosage", () => {
    const html = generatePrescriptionHtml(banglaData());
    expect(html).toContain("Test Chamber");
    expect(html).toContain("Napa 1");
    expect(html).toContain("1+0+1");
    expect(html).toContain("Rahim");
  });

  it("embeds a Bengali-capable font for both languages", () => {
    const html = generatePrescriptionHtml(baseData());
    expect(html).toContain("Noto+Sans+Bengali");
    expect(html).toContain("Noto Sans Bengali");
  });
});

describe("prescription rendering — five templates", () => {
  it.each(TEMPLATES)(
    "%s renders one footer, anchored, with all medicines and both languages",
    (template) => {
      const medicines = Array.from({ length: 4 }, (_, i) => snapshotMedicine(i + 1));
      const html = generatePrescriptionHtml(
        baseData({ template, language: "ENGLISH", medicines }),
      );
      expect((html.match(/class="page-footer"/g) || []).length).toBe(1);
      expect(html).toContain("margin-top: auto");
      expect(html).not.toContain("position: fixed");
      expect((html.match(/class="medicine-item"/g) || []).length).toBe(4);
      expect(html).toContain("Napa 1");
      expect(html).toContain("Napa 4");

      const bnHtml = generatePrescriptionHtml(
        baseData({ template, language: "BANGLA", medicines }),
      );
      expect(bnHtml).toContain("খাবার পরে");
    },
  );

  it("falls back to the default template for an unknown value", () => {
    const html = generatePrescriptionHtml(
      baseData({ template: "NOT_A_TEMPLATE" as any }),
    );
    expect(html).toContain("class=\"page-footer\"");
  });
});

describe("prescription view model", () => {
  it("normalises both snapshot and already-normalised medicine shapes", () => {
    const vm = buildPrescriptionViewModel(
      baseData({
        medicines: [
          snapshotMedicine(1),
          { brandName: "Ace", generic: "Paracetamol", strength: "250mg", type: "Syrup" },
        ] as any,
      }),
    );
    expect(vm.medicines[0]!.brandName).toBe("Napa 1");
    expect(vm.medicines[1]!.brandName).toBe("Ace");
  });
});
