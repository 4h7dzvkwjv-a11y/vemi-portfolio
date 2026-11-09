import type { Metadata } from "next";
import { PlanGeneratorDemo } from "./plan-generator-demo";

export const metadata: Metadata = {
  title: "Fundația generatorului de planuri · VEMI",
  description: "Ecran demonstrativ pentru infrastructura data-driven VEMI.",
};

export default function GeneratorPlanDemoPage() {
  return <PlanGeneratorDemo />;
}
