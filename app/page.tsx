import { VemiPage } from "../components/vemi-page";
import { STATIC_EXERCISE_CATALOG } from "../lib/exercises/static-catalog-adapter";

export default function Home() {
  return <VemiPage exerciseCatalog={STATIC_EXERCISE_CATALOG} />;
}
