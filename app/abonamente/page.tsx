import type { Metadata } from "next";
import { VemiPage } from "../../components/vemi-page";

export const metadata: Metadata = {
  title: "Abonamente VEMI",
  description: "Alege abonamentul VEMI potrivit pentru ritmul și nivelul de sprijin pe care îl dorești.",
};

export default function Abonamente() {
  return <VemiPage subscriptionsOnly exerciseCatalog={null} />;
}
