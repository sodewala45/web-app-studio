// Credit packs shown on the landing page. Prices are intentionally not set yet:
// payments are not switched on, so every "Buy credits" button opens a coming-soon dialog.
export const CREDIT_PACKS = [
  { name: "Starter", credits: 5, blurb: "Five Quick runs, or one Full run." },
  { name: "Founder", credits: 15, blurb: "Three Full runs, or a mix of Quick and Full." },
  { name: "Studio", credits: 40, blurb: "For agencies and founders who test many ideas." },
] as const;
