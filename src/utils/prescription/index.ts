import { IPdfRenderData } from "../../interface/pdf.type";
import { PrescriptionDesignTemplate } from "../../../generated/prisma/enums";
import { buildPrescriptionViewModel } from "./view-model";
import { renderDocument, TEMPLATE_RENDERERS } from "./templates";

// Single entry point for prescription rendering. Builds the shared view model
// once, then dispatches to the selected template. Both the browser preview and
// the printed/PDF output call this same function so they never diverge.
export const generatePrescriptionHtml = (data: IPdfRenderData): string => {
  const vm = buildPrescriptionViewModel(data);
  const renderer =
    TEMPLATE_RENDERERS[vm.template] ??
    TEMPLATE_RENDERERS[PrescriptionDesignTemplate.DEFAULT]!;
  return renderDocument(vm, renderer(vm));
};

export { buildPrescriptionViewModel } from "./view-model";
export {
  getPrescriptionLabels,
  translateMealTiming,
  isBangla,
} from "./language";
export type { PrescriptionViewModel, MedicineViewModel } from "./view-model";
