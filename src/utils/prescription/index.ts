import { IPdfRenderData } from "../../interface/pdf.type";
import { PrescriptionDesignTemplate } from "../../../generated/prisma/enums";
import { buildPrescriptionViewModel } from "./view-model";
import { renderDocument, TEMPLATE_RENDERERS } from "./templates";




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
