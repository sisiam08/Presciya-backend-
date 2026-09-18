// Backwards-compatible entry point. The prescription renderer now lives in
// ./prescription (shared view model + template registry). This re-export keeps
// existing imports working while all logic lives in one place.
export { generatePrescriptionHtml } from "./prescription";
