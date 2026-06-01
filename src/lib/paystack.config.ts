// DPOD top-up packages and subscription plan. Prices are in kobo (1 NGN = 100 kobo).
// This file is safe for client + server import.

export type TopupPack = {
  id: string;
  credits: number;
  amountKobo: number;
  label: string;
  highlight?: boolean;
};

export const TOPUP_PACKS: TopupPack[] = [
  { id: "starter", credits: 100, amountKobo: 15000, label: "Starter" },
  { id: "creator", credits: 500, amountKobo: 60000, label: "Creator", highlight: true },
  { id: "pro", credits: 2000, amountKobo: 200000, label: "Pro Pack" },
];

export const SUBSCRIPTION_PLAN = {
  id: "monthly_unlimited",
  credits: 2000,
  amountKobo: 200000, // ₦2,000 / month
  label: "Monthly Unlimited",
  description: "2,000 DPOD every month — enough for ~1,000 generations.",
};

export function formatNaira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`;
}
