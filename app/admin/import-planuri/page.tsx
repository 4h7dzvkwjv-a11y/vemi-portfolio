import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditorialFooter } from "../../../components/editorial/editorial-footer";
import { EditorialHeader } from "../../../components/editorial/editorial-header";
import type { ExerciseRegistryEntry, TrainingLocation } from "../../../lib/plan-engine/contracts";
import { getAdminContext } from "../../../utils/admin/server";
import { AdminPlanImport } from "./plan-import-client";
import styles from "./plan-import.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Validare loturi de planuri · VEMI",
  description: "Instrument privat VEMI pentru validarea dry-run a configurațiilor de plan.",
  robots: { index: false, follow: false },
};

type ExerciseRow = {
  exercise_key: string;
  canonical_name: string;
  places: string[];
  is_active: boolean;
};

function normalizeLocations(places: string[]): TrainingLocation[] {
  return places
    .map((place) => place === "acasa" ? "home" : place === "sala" ? "gym" : null)
    .filter((place): place is TrainingLocation => place !== null);
}

export default async function AdminPlanImportPage() {
  const admin = await getAdminContext();
  if (!admin.authorized) notFound();

  const { data, error } = await admin.supabase
    .from("exercises")
    .select("exercise_key, canonical_name, places, is_active")
    .order("exercise_key");

  if (error) throw new Error("Registrul canonic de exerciții nu a putut fi citit în siguranță.");

  const exerciseRegistry: ExerciseRegistryEntry[] = ((data as ExerciseRow[] | null) ?? []).map((row) => ({
    exercise_key: row.exercise_key,
    display_name: row.canonical_name,
    status: row.is_active ? "active" : "inactive",
    available_locations: normalizeLocations(row.places),
  }));

  if (!exerciseRegistry.some((exercise) => exercise.status === "active" && exercise.available_locations.length > 0)) {
    throw new Error("Nu există niciun exercițiu canonic activ pentru fixture-ul de validare.");
  }

  return (
    <div className={`editorial-site ${styles.site}`}>
      <EditorialHeader />
      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <p className="section-kicker">Administrare VEMI · dry-run</p>
            <h1>Validarea loturilor de planuri</h1>
          </div>
          <p>Încarcă date normalizate, verifică întregul lot și primește un raport înainte ca orice etapă de aprobare sau activare să existe.</p>
        </header>
        <AdminPlanImport exerciseRegistry={exerciseRegistry} />
      </main>
      <EditorialFooter />
    </div>
  );
}
