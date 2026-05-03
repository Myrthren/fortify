export const CREDIT_PACKS = [
  {
    id:       "pack_800",
    credits:  800,
    price:    "8.99",
    label:    "Starter",
    highlight: false,
  },
  {
    id:       "pack_1600",
    credits:  1600,
    price:    "14.99",
    label:    "Growth",
    highlight: false,
  },
  {
    id:       "pack_3400",
    credits:  3400,
    price:    "24.99",
    label:    "Scale",
    highlight: true, // Popular
  },
  {
    id:       "pack_5200",
    credits:  5200,
    price:    "36.99",
    label:    "Power",
    highlight: false,
  },
] as const;

export type PackId = (typeof CREDIT_PACKS)[number]["id"];

export function getPackById(id: string) {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null;
}

/** Price per credit in pence, rounded to 2dp */
export function pencePerCredit(pack: (typeof CREDIT_PACKS)[number]) {
  return ((parseFloat(pack.price) / pack.credits) * 100).toFixed(2);
}
