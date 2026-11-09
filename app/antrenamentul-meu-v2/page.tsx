import type { Metadata } from "next";
import { Amv2Client } from "@/components/amv2/amv2-client";

export const metadata: Metadata = {
  title: "Antrenamentul meu V2 — VEMI",
  description: "Calendarul local VEMI pentru exerciții și valori de antrenament.",
};

export default function AntrenamentulMeuV2Page() {
  return <Amv2Client />;
}
