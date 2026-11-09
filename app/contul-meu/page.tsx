import { createClient } from "../../utils/supabase/server";
import { AccountClient } from "./account-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Dashboard = {
  activePlan: null | {
    title: string;
    place: "acasa" | "sala";
    week: number;
    day: number;
    completed: number;
    total: number;
    progress: number;
    nextWorkout: string;
  };
  lastWorkout: null | { name: string; date: string; duration: number; exerciseCount: number };
  history: Array<{ id: string; name: string; date: string; duration: number; exerciseCount: number; source: string }>;
  customWorkouts: Array<{ id: string; name: string; place: "acasa" | "sala"; exerciseCount: number; completions: number; lastCompleted?: string }>;
};

const workoutNames = {
  sala: ["Piept, umeri și triceps", "Spate și biceps", "Picioare și abdomen"],
  acasa: ["Tot corpul", "Picioare și cardio", "Partea superioară și abdomen"],
};

const goalLabels: Record<string, string> = {
  masa: "Masă musculară",
  slabire: "Slăbire",
  forma: "Formă fizică",
};

export default async function ContulMeu({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const requestedNext = (await searchParams).next;
  const returnTo = requestedNext === "/admin/exercitii-video" ? requestedNext : undefined;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;

  let account: { username: string; email: string; role: "user" | "admin" } | null = null;
  let dashboard: Dashboard | null = null;

  if (userId) {
    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      supabase.from("profiles").select("username").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    ]);

    account = {
      username: profile?.username ?? "utilizator",
      email: typeof claimsData?.claims?.email === "string" ? claimsData.claims.email : "",
      role: roleRow?.role === "admin" ? "admin" : "user",
    };

    const [planResult, sessionResult, exerciseLogResult, customResult, customExerciseResult] = await Promise.all([
      supabase.from("user_free_plans").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("workout_sessions").select("*").eq("user_id", userId).eq("status", "completed").order("completed_at", { ascending: false }).limit(12),
      supabase.from("workout_exercise_logs").select("session_id").eq("user_id", userId).eq("completed", true),
      supabase.from("custom_workouts").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
      supabase.from("custom_workout_exercises").select("workout_id").eq("user_id", userId),
    ]);

    const progressTablesReady = ![planResult, sessionResult, exerciseLogResult, customResult, customExerciseResult]
      .some((result) => result.error);

    if (progressTablesReady) {
      const plan = planResult.data;
      const sessions = sessionResult.data ?? [];
      const exerciseLogs = exerciseLogResult.data ?? [];
      const customs = customResult.data ?? [];
      const customExercises = customExerciseResult.data ?? [];
      const history = sessions.map((session) => ({
        id: session.id,
        name: session.workout_name,
        date: session.completed_at ?? session.updated_at,
        duration: Math.round(session.duration_seconds / 60),
        exerciseCount: exerciseLogs.filter((exercise) => exercise.session_id === session.id).length,
        source: session.source,
      }));

      dashboard = {
        activePlan: plan ? {
          title: goalLabels[plan.goal] ?? "Plan gratuit VEMI",
          place: plan.place,
          week: plan.current_week,
          day: plan.current_day,
          completed: plan.completed_workouts,
          total: plan.total_workouts,
          progress: Math.round((plan.completed_workouts / plan.total_workouts) * 100),
          nextWorkout: String(plan.plan_key).startsWith("plan:v2:")
            ? `Ziua ${plan.current_day} · ${goalLabels[plan.goal] ?? "Plan VEMI"}`
            : workoutNames[plan.place][Math.max(0, Math.min(2, plan.current_day - 1))],
        } : null,
        lastWorkout: history[0] ? {
          name: history[0].name,
          date: history[0].date,
          duration: history[0].duration,
          exerciseCount: history[0].exerciseCount,
        } : null,
        history,
        customWorkouts: customs.map((workout) => ({
          id: workout.client_key,
          name: workout.name,
          place: workout.place,
          exerciseCount: customExercises.filter((exercise) => exercise.workout_id === workout.id).length,
          completions: workout.completions,
          lastCompleted: workout.last_completed_at ?? undefined,
        })),
      };
    }
  }

  return <AccountClient account={account} dashboard={dashboard} returnTo={returnTo} />;
}
