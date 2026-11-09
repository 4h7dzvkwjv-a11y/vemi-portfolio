"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkoutExercise } from "@/lib/amv2/draft-domain.mjs";
import { getWorkoutExerciseIdentity } from "@/lib/amv2/draft-domain.mjs";
import type { Amv2AccountSyncEnvelope, Amv2OutboxOperation } from "@/lib/amv2/account-sync-local.mjs";
import {
  enqueueAccountOperation,
  getAccountOperationDependencies,
  markAccountOperationRetry,
  quarantineAccountOperation,
  recordImportBatch,
  replacePersonalExerciseInSync,
  resolveAccountConflictWithLocal,
  selectNextAccountOperation,
} from "@/lib/amv2/account-sync-local.mjs";
import { hydrateCloudCalendarSnapshot, serializePersonalExerciseForCloud, serializeWorkoutDayForCloud } from "@/lib/amv2/cloud-graph.mjs";
import {
  advanceHistoryCoverage,
  isHistoryCoverageComplete,
  markHistoryCoverageError,
  markHistoryCoverageStale,
  readHistoryCoverage,
  restartHistoryCoverage,
  withHistoryCoverage,
} from "@/lib/amv2/cloud-history-coverage.mjs";
import { probeAmv2Account, readAmv2HistoryPage, sendAmv2Operation } from "@/lib/amv2/cloud-sync-client";
import type {
  Amv2DurableStore,
  Amv2OwnerScope,
  DurableOwnerState,
  LocalOnlyMarker,
} from "@/lib/amv2/durable-local-store.mjs";
import {
  Amv2DurableLocalError,
  createAnonymousOwnerScope,
  createAuthenticatedOwnerScope,
  getOrCreateAnonymousInstallationId,
  openAmv2DurableStore,
} from "@/lib/amv2/durable-local-store.mjs";
import { resolveCanonicalExerciseMetric } from "@/lib/amv2/exercise-metric-map.mjs";
import { createOwnerScopeCoordinator } from "@/lib/amv2/owner-scope-coordinator.mjs";
import type { OwnerScopeToken } from "@/lib/amv2/owner-scope-coordinator.mjs";
import {
  adoptRemoteConflictProjection,
  reconcileCloudConflictOwnerProjection,
  reconcileConfirmedOwnerProjection,
  reconcileRemoteOwnerHistoryPage,
  reconcileRemoteOwnerProjection,
} from "@/lib/amv2/owner-sync-projection.mjs";
import type { WorkoutCalendarEnvelope } from "@/lib/amv2/workout-calendar-local.mjs";
import { replaceWorkoutDayInCalendar } from "@/lib/amv2/workout-calendar-local.mjs";
import type { WorkoutDay } from "@/lib/amv2/workout-day-domain.mjs";
import {
  addExerciseToWorkoutDay,
  createWorkoutDayExercise,
  createPersonalWorkoutDayExercise,
  deriveWorkoutDayMuscleGroups,
  monthKeyFromDateKey,
  removeExerciseFromWorkoutDay,
  shiftMonthKey,
  toLocalDateKey,
  updateWorkoutDayExercise,
  WORKOUT_DAY_LIMITS,
  WorkoutDayDomainError,
} from "@/lib/amv2/workout-day-domain.mjs";
import type { PersonalExercise } from "@/lib/amv2/personal-exercise-domain.mjs";
import {
  archivePersonalExercise,
  createPersonalExercise,
  listActivePersonalExercises,
  updatePersonalExercise,
} from "@/lib/amv2/personal-exercise-domain.mjs";
import { copyV1WorkoutIntoDate, readV1CompatibilitySource } from "@/lib/amv2/v1-compatibility.mjs";
import {
  deriveWorkoutStatistics,
  findExerciseHistory,
  selectRecentExerciseOccurrences,
} from "@/lib/amv2/workout-statistics.mjs";
import {
  fetchActiveCatalog,
  selectPlayableExerciseKeys,
} from "@/lib/exercises/catalog-delivery.mjs";
import { createClient as createSupabaseBrowserClient } from "@/utils/supabase/client";
import { AddExercisesPanel } from "./add-exercises-panel";
import type { CatalogSource } from "./add-exercises-panel";
import { Amv2Header } from "./amv2-header";
import { Amv2Hero } from "./amv2-hero";
import { EditableExerciseCard } from "./editable-exercise-card";
import { ExerciseCategoryBadge } from "./exercise-visual-controls";
import { ExerciseHistoryView } from "./exercise-history-view";
import { MonthlyWorkoutCalendar } from "./monthly-workout-calendar";
import { PersonalExerciseEditor } from "./personal-exercise-editor";
import { V1ImportPanel } from "./v1-import-panel";
import { WorkoutDayExerciseCard } from "./workout-day-exercise-card";
import { StatisticsLauncher } from "./statistics-launcher";
import { StatisticsView } from "./statistics-view";
import styles from "./amv2.module.css";

type CalendarScreen = "day" | "catalog" | "editor" | "personal" | "v1-import" | "statistics" | "history";

type ExerciseEditorState = {
  mode: "new" | "existing";
  exercise: WorkoutExercise;
};

type AccountState =
  | { status: "checking" | "local" }
  | { status: "offline"; ownerUserId?: string }
  | { status: "authenticated" | "saving" | "saved" | "conflict"; ownerUserId: string };

function makeLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatSelectedDate(dateKey: string) {
  const formatted = new Intl.DateTimeFormat("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${dateKey}T12:00:00`));
  return formatted.charAt(0).toLocaleUpperCase("ro-RO") + formatted.slice(1);
}

function isStaleSyncRevision(error: unknown) {
  return error instanceof Amv2DurableLocalError && error.code === "STALE_SYNC_REVISION";
}

export function Amv2Client() {
  const [envelope, setEnvelope] = useState<WorkoutCalendarEnvelope | null>(null);
  const [todayDate, setTodayDate] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [monthKey, setMonthKey] = useState("");
  const [screen, setScreen] = useState<CalendarScreen>("day");
  const [editor, setEditor] = useState<ExerciseEditorState | null>(null);
  const [storageReady, setStorageReady] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [syncEnvelope, setSyncEnvelope] = useState<Amv2AccountSyncEnvelope | null>(null);
  const [account, setAccount] = useState<AccountState>({ status: "checking" });
  const [personalEditor, setPersonalEditor] = useState<PersonalExercise | null | undefined>(undefined);
  const [catalogSource, setCatalogSource] = useState<CatalogSource>("vemi");
  const [v1Source, setV1Source] = useState<ReturnType<typeof readV1CompatibilitySource> | null>(null);
  const [historyIdentity, setHistoryIdentity] = useState<string | null>(null);
  const [historyReturnScreen, setHistoryReturnScreen] = useState<"day" | "editor" | "statistics">("day");
  const [localOnlyDayDates, setLocalOnlyDayDates] = useState<ReadonlySet<string>>(() => new Set());
  const [localOnlyPersonalIds, setLocalOnlyPersonalIds] = useState<ReadonlySet<string>>(() => new Set());
  const [scopeGeneration, setScopeGeneration] = useState(0);
  const [coverageState, setCoverageState] = useState<Record<string, unknown>>({});
  const [historyBackfillTrigger, setHistoryBackfillTrigger] = useState(0);
  const [connectivityGeneration, setConnectivityGeneration] = useState(0);
  const [playableExerciseKeys, setPlayableExerciseKeys] = useState<ReadonlySet<string>>(() => new Set());
  const syncRef = useRef<Amv2AccountSyncEnvelope | null>(null);
  const calendarRef = useRef<WorkoutCalendarEnvelope | null>(null);
  const coverageRef = useRef<Record<string, unknown>>({});
  const syncRevisionRef = useRef(0);
  const localOnlyMarkersRef = useRef<LocalOnlyMarker[]>([]);
  const localOnlyDayDatesRef = useRef<Set<string>>(new Set());
  const localOnlyPersonalIdsRef = useRef<Set<string>>(new Set());
  const durableStoreRef = useRef<Amv2DurableStore | null>(null);
  const durableOpenPromiseRef = useRef<Promise<Amv2DurableStore> | null>(null);
  const activeScopeRef = useRef<Amv2OwnerScope | null>(null);
  const anonymousScopeRef = useRef<Amv2OwnerScope | null>(null);
  const activeScopeTokenRef = useRef<OwnerScopeToken | null>(null);
  const flushInFlightScopesRef = useRef<Set<string>>(new Set());
  const scopeCoordinatorRef = useRef(createOwnerScopeCoordinator<DurableOwnerState | null>({
    createEmptyProjection: () => null,
  }));
  const switchOwnerScopeRef = useRef<(scope: Amv2OwnerScope, verifiedOwnerUserId?: string | null) => Promise<void>>(
    async () => {},
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void fetchActiveCatalog({ signal: controller.signal })
      .then((payload) => {
        if (active) setPlayableExerciseKeys(selectPlayableExerciseKeys(payload));
      })
      .catch(() => {
        if (active && !controller.signal.aborted) setPlayableExerciseKeys(new Set());
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const publishLocalOnlyMarkers = useCallback((markers: readonly LocalOnlyMarker[]) => {
    const nextMarkers = markers.map((marker) => ({ ...marker }));
    const dayDates = new Set(nextMarkers.flatMap((marker) => marker.identity.startsWith("day:")
      ? [marker.identity.slice("day:".length)]
      : []));
    const personalIds = new Set(nextMarkers.flatMap((marker) => marker.identity.startsWith("personal:")
      ? [marker.identity.slice("personal:".length)]
      : []));
    localOnlyMarkersRef.current = nextMarkers;
    localOnlyDayDatesRef.current = dayDates;
    localOnlyPersonalIdsRef.current = personalIds;
    setLocalOnlyDayDates(new Set(dayDates));
    setLocalOnlyPersonalIds(new Set(personalIds));
  }, []);

  const publishOwnerProjection = useCallback((projection: DurableOwnerState) => {
    calendarRef.current = projection.calendar;
    syncRef.current = projection.sync;
    coverageRef.current = { ...projection.coverage };
    syncRevisionRef.current = projection.syncRevision;
    setEnvelope(projection.calendar);
    setSyncEnvelope(projection.sync);
    setCoverageState({ ...projection.coverage });
    publishLocalOnlyMarkers(projection.localOnly);
  }, [publishLocalOnlyMarkers]);

  const clearOwnerProjection = useCallback(() => {
    calendarRef.current = null;
    syncRef.current = null;
    coverageRef.current = {};
    syncRevisionRef.current = 0;
    setEnvelope(null);
    setSyncEnvelope(null);
    setCoverageState({});
    setHistoryBackfillTrigger(0);
    publishLocalOnlyMarkers([]);
    setEditor(null);
    setPersonalEditor(undefined);
    setHistoryIdentity(null);
    setV1Source(null);
    setScreen("day");
    setMessage(null);
  }, [publishLocalOnlyMarkers]);

  const reloadActiveOwnerProjection = useCallback(async (
    scope: Amv2OwnerScope,
    token: OwnerScopeToken,
    store: Amv2DurableStore,
  ) => {
    const projection = await store.loadOwnerState(scope);
    if (activeScopeRef.current?.key !== scope.key || !scopeCoordinatorRef.current.isCurrent(token)) return null;
    publishOwnerProjection(projection);
    return projection;
  }, [publishOwnerProjection]);

  useEffect(() => {
    let disposed = false;
    let unsubscribeAuth: (() => void) | null = null;
    const scopeCoordinator = scopeCoordinatorRef.current;

    const openStore = async () => {
      if (!durableOpenPromiseRef.current) durableOpenPromiseRef.current = openAmv2DurableStore();
      const store = await durableOpenPromiseRef.current;
      durableStoreRef.current = store;
      return store;
    };

    const switchOwnerScope = async (scope: Amv2OwnerScope, verifiedOwnerUserId: string | null = null) => {
      const coordinator = scopeCoordinator;
      const currentState = coordinator.getState();
      if (currentState.scopeKey === scope.key && (currentState.status === "loading" || currentState.status === "ready")) return;
      const transition = coordinator.beginScopeTransition(scope);
      activeScopeRef.current = scope;
      activeScopeTokenRef.current = transition.token;
      clearOwnerProjection();
      setAccount({ status: "checking" });
      try {
        const store = await openStore();
        if (disposed || !coordinator.isCurrent(transition.token)) return;
        const anonymousScope = anonymousScopeRef.current;
        if (!anonymousScope || anonymousScope.kind !== "anonymous") throw new Error("Partiția anonimă AMV2 nu este disponibilă.");
        const timestamp = new Date().toISOString();
        await store.migrateLegacyLocalStorage({
          legacyStorage: window.localStorage,
          anonymousScope,
          verifiedOwnerUserId,
          timestamp,
        });
        if (disposed || !coordinator.isCurrent(transition.token)) return;
        const projection = await store.loadOwnerState(scope);
        const completion = coordinator.completeHydration(transition.token, { scopeKey: scope.key, projection });
        if (!completion.accepted || disposed) return;
        publishOwnerProjection(projection);
        setStorageReady(true);
        setAccount(scope.kind === "authenticated"
          ? { status: "offline", ownerUserId: scope.ownerUserId }
          : { status: "local" });
        setScopeGeneration((value) => value + 1);
      } catch (error) {
        coordinator.failHydration(transition.token, { code: "DURABLE_HYDRATION_FAILED" });
        if (!disposed && coordinator.isCurrent(transition.token)) {
          setStorageReady(false);
          setAccount(scope.kind === "authenticated"
            ? { status: "offline", ownerUserId: scope.ownerUserId }
            : { status: "local" });
          setMessage(error instanceof Error ? error.message : "Stocarea locală AMV2 nu poate fi deschisă.");
        }
      }
    };
    switchOwnerScopeRef.current = switchOwnerScope;

    const initialize = async () => {
      const now = new Date();
      const today = toLocalDateKey(now);
      const currentMonth = monthKeyFromDateKey(today);
      let anonymousScope: Amv2OwnerScope | null = null;
      setTodayDate(today);
      setSelectedDate(today);
      setMonthKey(currentMonth);
      try {
        const installationId = getOrCreateAnonymousInstallationId(window.localStorage);
        anonymousScope = createAnonymousOwnerScope(installationId);
        anonymousScopeRef.current = anonymousScope;
        await openStore();
        if (disposed) return;
        const supabase = createSupabaseBrowserClient();
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
          const nextOwnerUserId = session?.user.id ?? null;
          const nextScope = nextOwnerUserId
            ? createAuthenticatedOwnerScope(nextOwnerUserId)
            : anonymousScopeRef.current;
          if (!disposed && nextScope) void switchOwnerScope(nextScope, nextOwnerUserId);
        });
        unsubscribeAuth = () => listener.subscription.unsubscribe();
        const { data } = await supabase.auth.getSession();
        if (disposed) return;
        const ownerUserId = data.session?.user.id ?? null;
        await switchOwnerScope(
          ownerUserId ? createAuthenticatedOwnerScope(ownerUserId) : anonymousScope,
          ownerUserId,
        );
      } catch (error) {
        if (disposed) return;
        if (anonymousScope) {
          anonymousScopeRef.current = anonymousScope;
          await switchOwnerScope(anonymousScope, null);
        } else {
          clearOwnerProjection();
          setStorageReady(false);
          setAccount({ status: "local" });
        }
        if (!disposed) setMessage(error instanceof Error ? error.message : "Stocarea locală AMV2 nu este disponibilă.");
      }
    };
    void initialize();
    return () => {
      disposed = true;
      unsubscribeAuth?.();
      scopeCoordinator.clearActiveScope();
      activeScopeRef.current = null;
      activeScopeTokenRef.current = null;
      durableStoreRef.current?.close();
      durableStoreRef.current = null;
      durableOpenPromiseRef.current = null;
    };
  }, [clearOwnerProjection, publishOwnerProjection]);

  useEffect(() => {
    const retry = () => {
      setConnectivityGeneration((value) => value + 1);
      setHistoryBackfillTrigger((value) => value + 1);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  const commitSyncEnvelope = async (next: Amv2AccountSyncEnvelope) => {
    const scope = activeScopeRef.current;
    const token = activeScopeTokenRef.current;
    const store = durableStoreRef.current;
    if (!scope || !token || !store || !scopeCoordinatorRef.current.isCurrent(token)) return false;
    try {
      const committed = await store.commitSyncState(scope, {
        nextSyncEnvelope: next,
        expectedSyncRevision: syncRevisionRef.current,
      });
      if (activeScopeRef.current?.key !== scope.key || !scopeCoordinatorRef.current.isCurrent(token)) return false;
      syncRevisionRef.current = committed.syncRevision;
      syncRef.current = next;
      setSyncEnvelope(next);
      return true;
    } catch (error) {
      if (isStaleSyncRevision(error)) {
        await reloadActiveOwnerProjection(scope, token, store);
        setMessage("Starea locală a fost actualizată în altă filă. Reia acțiunea pe versiunea curentă.");
        return false;
      }
      setMessage(error instanceof Error ? error.message : "Starea locală de sincronizare nu a putut fi salvată.");
      return false;
    }
  };

  const reloadAlreadyCommittedMutation = async (
    status: "saved" | "already_committed",
    scope: Amv2OwnerScope,
    token: OwnerScopeToken,
    store: Amv2DurableStore,
  ) => {
    if (status !== "already_committed") return false;
    if (!await reloadActiveOwnerProjection(scope, token, store)) {
      throw new Error("Modificarea era deja salvată, dar starea autoritativă locală nu a putut fi reîncărcată.");
    }
    return true;
  };

  const daysByDate = useMemo(
    () => new Map((envelope?.days ?? []).map((day) => [day.date, day])),
    [envelope?.days],
  );
  const selectedDay = selectedDate ? daysByDate.get(selectedDate) ?? null : null;
  const selectedLocation = selectedDay?.location ?? "gym";
  const selectedGroups = selectedDay ? deriveWorkoutDayMuscleGroups(selectedDay) : [];
  const statistics = useMemo(
    () => deriveWorkoutStatistics(envelope?.days ?? [], todayDate),
    [envelope?.days, todayDate],
  );
  const selectedHistory = useMemo(
    () => historyIdentity ? findExerciseHistory(statistics, historyIdentity) : null,
    [historyIdentity, statistics],
  );
  const editorIdentity = editor ? getWorkoutExerciseIdentity(editor.exercise) : null;
  const editorHistory = useMemo(
    () => editorIdentity ? findExerciseHistory(statistics, editorIdentity) : null,
    [editorIdentity, statistics],
  );
  const editorRecentOccurrences = useMemo(
    () => selectRecentExerciseOccurrences(editorHistory, selectedDate),
    [editorHistory, selectedDate],
  );
  const activePersonalExercises = useMemo(
    () => syncEnvelope ? listActivePersonalExercises(syncEnvelope.personalExercises) : [],
    [syncEnvelope],
  );
  const authenticatedOwnerActive = "ownerUserId" in account && typeof account.ownerUserId === "string";
  const historyProjectionComplete = !authenticatedOwnerActive || isHistoryCoverageComplete(coverageState);

  const showScreen = (nextScreen: CalendarScreen) => {
    setScreen(nextScreen);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  useEffect(() => {
    const scope = activeScopeRef.current;
    const token = activeScopeTokenRef.current;
    const store = durableStoreRef.current;
    if (!monthKey || !scope || !token || !store || !calendarRef.current || !syncRef.current) return;
    const controller = new AbortController();
    const isCurrentScope = () => !controller.signal.aborted
      && activeScopeRef.current?.key === scope.key
      && scopeCoordinatorRef.current.isCurrent(token);
    const synchronize = async () => {
      const probe = await probeAmv2Account(monthKey, controller.signal);
      if (!isCurrentScope()) return;
      if (probe.status === "unauthenticated") {
        const anonymousScope = anonymousScopeRef.current;
        if (scope.kind === "authenticated" && anonymousScope) {
          void switchOwnerScopeRef.current(anonymousScope, null);
        } else {
          setAccount({ status: "local" });
        }
        return;
      }
      if (probe.status === "offline" || probe.status === "unavailable") {
        setAccount(scope.kind === "authenticated"
          ? { status: "offline", ownerUserId: scope.ownerUserId }
          : { status: "offline" });
        return;
      }
      const snapshot = probe.snapshot as Record<string, unknown>;
      const ownerUserId = typeof snapshot.ownerUserId === "string" ? snapshot.ownerUserId : null;
      if (!ownerUserId) {
        const anonymousScope = anonymousScopeRef.current;
        if (anonymousScope) void switchOwnerScopeRef.current(anonymousScope, null);
        return;
      }
      if (scope.kind !== "authenticated" || scope.ownerUserId !== ownerUserId) {
        void switchOwnerScopeRef.current(createAuthenticatedOwnerScope(ownerUserId), ownerUserId);
        return;
      }
      try {
        const timestamp = new Date().toISOString();
        const hydrated = hydrateCloudCalendarSnapshot(snapshot);
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const currentCalendar = calendarRef.current;
          const currentSync = syncRef.current;
          if (!currentCalendar || !currentSync || !isCurrentScope()) return;
          const reconciliation = reconcileRemoteOwnerProjection({
            calendar: currentCalendar,
            sync: currentSync,
            localOnly: localOnlyMarkersRef.current,
            remote: hydrated,
            monthKey,
            timestamp,
          });
          const currentHistory = readHistoryCoverage(coverageRef.current);
          const snapshotRevision = Number(snapshot.snapshotRevision);
          const nextHistory = currentHistory.status === "complete"
            && Number.isInteger(snapshotRevision)
            && snapshotRevision >= 0
            && currentHistory.snapshotRevision !== snapshotRevision
            ? markHistoryCoverageStale(currentHistory)
            : currentHistory;
          const nextCoverage = withHistoryCoverage({
            ...coverageRef.current,
            [`month:${monthKey}`]: timestamp,
          }, nextHistory);
          try {
            const committed = await store.commitOwnerTransition(scope, {
              dayChanges: reconciliation.dayChanges,
              calendarRevision: reconciliation.calendar.revision,
              calendarUpdatedAt: reconciliation.calendar.updatedAt,
              sync: reconciliation.sync,
              coverage: nextCoverage,
              expectedSyncRevision: syncRevisionRef.current,
            });
            if (!isCurrentScope()) return;
            syncRevisionRef.current = committed.syncRevision;
            calendarRef.current = reconciliation.calendar;
            syncRef.current = reconciliation.sync;
            setEnvelope(reconciliation.calendar);
            setSyncEnvelope(reconciliation.sync);
            coverageRef.current = nextCoverage;
            setCoverageState(nextCoverage);
            setAccount(reconciliation.hasConflict
              ? { status: "conflict", ownerUserId }
              : { status: "authenticated", ownerUserId });
            if (!reconciliation.hasConflict) setHistoryBackfillTrigger((value) => value + 1);
            return;
          } catch (error) {
            if (!isStaleSyncRevision(error) || attempt === 1) throw error;
            if (!await reloadActiveOwnerProjection(scope, token, store)) return;
          }
        }
      } catch (error) {
        if (!isCurrentScope()) return;
        setAccount({ status: "offline", ownerUserId });
        setMessage(error instanceof Error ? error.message : "Calendarul din cont nu poate fi reconciliat acum.");
      }
    };
    void synchronize();
    return () => controller.abort();
  }, [connectivityGeneration, monthKey, reloadActiveOwnerProjection, scopeGeneration]);

  useEffect(() => {
    const scope = activeScopeRef.current;
    const token = activeScopeTokenRef.current;
    const store = durableStoreRef.current;
    if (historyBackfillTrigger === 0
      || !scope
      || scope.kind !== "authenticated"
      || !token
      || !store
      || !calendarRef.current
      || !syncRef.current) return;
    const controller = new AbortController();
    const isCurrentScope = () => !controller.signal.aborted
      && activeScopeRef.current?.key === scope.key
      && scopeCoordinatorRef.current.isCurrent(token);

    const persistCoverageOnly = async (history: ReturnType<typeof readHistoryCoverage>) => {
      const nextCoverage = withHistoryCoverage(coverageRef.current, history);
      try {
        const committed = await store.commitOwnerTransition(scope, {
          coverage: nextCoverage,
          expectedSyncRevision: syncRevisionRef.current,
        });
        if (!isCurrentScope()) return false;
        syncRevisionRef.current = committed.syncRevision;
        coverageRef.current = nextCoverage;
        setCoverageState(nextCoverage);
        return true;
      } catch (error) {
        if (!isStaleSyncRevision(error)) throw error;
        await reloadActiveOwnerProjection(scope, token, store);
        return false;
      }
    };

    const hydrateHistory = async () => {
      let restartCount = 0;
      while (isCurrentScope()) {
        let history = readHistoryCoverage(coverageRef.current);
        if (history.status === "stale") {
          history = restartHistoryCoverage();
          if (!await persistCoverageOnly(history)) continue;
        }
        const verifyingComplete = history.status === "complete";
        const requestCursor = verifyingComplete ? null : history.cursor;
        const requestRevision = history.snapshotRevision;
        const result = await readAmv2HistoryPage({
          cursor: requestCursor,
          snapshotRevision: requestRevision,
          signal: controller.signal,
        });
        if (!isCurrentScope()) return;
        if (result.status === "unauthenticated") {
          const anonymousScope = anonymousScopeRef.current;
          if (anonymousScope) void switchOwnerScopeRef.current(anonymousScope, null);
          return;
        }
        if (result.status === "snapshot_changed") {
          restartCount += 1;
          if (restartCount > 3) {
            await persistCoverageOnly(markHistoryCoverageError(history, "HISTORY_REVISION_CHURN"));
            setAccount({ status: "offline", ownerUserId: scope.ownerUserId });
            return;
          }
          if (!await persistCoverageOnly(restartHistoryCoverage())) continue;
          continue;
        }
        if (result.status === "offline" || result.status === "unavailable") {
          await persistCoverageOnly(markHistoryCoverageError(history, result.status === "offline" ? "OFFLINE" : "UNAVAILABLE"));
          setAccount({ status: "offline", ownerUserId: scope.ownerUserId });
          return;
        }
        if (result.status !== "authenticated") return;
        if (result.ownerUserId !== scope.ownerUserId) return;
        if (verifyingComplete) return;

        const durableHistory = readHistoryCoverage(coverageRef.current);
        if (durableHistory.cursor !== requestCursor || durableHistory.snapshotRevision !== requestRevision) continue;
        const timestamp = new Date().toISOString();
        const hydrated = hydrateCloudCalendarSnapshot(result.page);
        const currentCalendar = calendarRef.current;
        const currentSync = syncRef.current;
        if (!currentCalendar || !currentSync) return;
        const reconciliation = reconcileRemoteOwnerHistoryPage({
          calendar: currentCalendar,
          sync: currentSync,
          localOnly: localOnlyMarkersRef.current,
          remote: hydrated,
          timestamp,
        });
        const nextHistory = advanceHistoryCoverage(durableHistory, result.page, timestamp);
        const nextCoverage = withHistoryCoverage(coverageRef.current, nextHistory);
        try {
          const committed = await store.commitOwnerTransition(scope, {
            dayChanges: reconciliation.dayChanges,
            calendarRevision: reconciliation.calendar.revision,
            calendarUpdatedAt: reconciliation.calendar.updatedAt,
            sync: reconciliation.sync,
            coverage: nextCoverage,
            expectedSyncRevision: syncRevisionRef.current,
          });
          if (!isCurrentScope()) return;
          syncRevisionRef.current = committed.syncRevision;
          calendarRef.current = reconciliation.calendar;
          syncRef.current = reconciliation.sync;
          coverageRef.current = nextCoverage;
          setCoverageState(nextCoverage);
          if (reconciliation.hasConflict || nextHistory.status === "complete") {
            setEnvelope(reconciliation.calendar);
            setSyncEnvelope(reconciliation.sync);
          }
          if (reconciliation.hasConflict) {
            setAccount({ status: "conflict", ownerUserId: scope.ownerUserId });
            return;
          }
          setAccount({ status: "authenticated", ownerUserId: scope.ownerUserId });
          if (nextHistory.status === "complete") return;
        } catch (error) {
          if (!isStaleSyncRevision(error)) throw error;
          await reloadActiveOwnerProjection(scope, token, store);
        }
      }
    };
    void hydrateHistory().catch(async (error) => {
      if (!isCurrentScope()) return;
      const history = readHistoryCoverage(coverageRef.current);
      await persistCoverageOnly(markHistoryCoverageError(history, "HYDRATION_FAILED"));
      setAccount({ status: "offline", ownerUserId: scope.ownerUserId });
      setMessage(error instanceof Error ? error.message : "Istoricul complet nu poate fi sincronizat momentan.");
    });
    return () => controller.abort();
  }, [historyBackfillTrigger, reloadActiveOwnerProjection, scopeGeneration]);

  const flushAccountOutbox = useCallback(async (ownerUserId: string) => {
    const scope = activeScopeRef.current;
    const token = activeScopeTokenRef.current;
    const store = durableStoreRef.current;
    if (!scope || scope.kind !== "authenticated" || scope.ownerUserId !== ownerUserId || !token || !store) return;
    const flushKey = `${scope.key}:${token.epoch}`;
    if (flushInFlightScopesRef.current.has(flushKey)) return;
    flushInFlightScopesRef.current.add(flushKey);
    const isCurrentScope = () => activeScopeRef.current?.key === scope.key
      && scopeCoordinatorRef.current.isCurrent(token);
    try {
      while (true) {
        const current = syncRef.current;
        const operation = current ? selectNextAccountOperation(current, ownerUserId) : null;
        const currentCalendar = calendarRef.current;
        if (!current || !currentCalendar || !operation || !isCurrentScope()) break;
        setAccount({ status: "saving", ownerUserId });
        const result = await sendAmv2Operation(operation);
        const latest = syncRef.current;
        const latestCalendar = calendarRef.current;
        if (!latest || !latestCalendar || !isCurrentScope()) break;
        if (result.status === "confirmed") {
          const timestamp = new Date().toISOString();
          let acknowledged = false;
          for (let attempt = 0; attempt < 2; attempt += 1) {
            const activeSync = syncRef.current;
            const activeCalendar = calendarRef.current;
            if (!activeSync || !activeCalendar || !isCurrentScope()) break;
            const reconciled = reconcileConfirmedOwnerProjection({
              calendar: activeCalendar,
              sync: activeSync,
              operationKey: operation.operationKey,
              remoteIdentity: result.remoteIdentity,
              revision: result.revision,
              canonicalCandidate: result.canonicalCandidate,
              deleted: result.deleted,
              timestamp,
            });
            const currentHistory = readHistoryCoverage(coverageRef.current);
            const nextHistory = currentHistory.snapshotRevision === null
              ? currentHistory
              : markHistoryCoverageStale(currentHistory);
            const nextCoverage = withHistoryCoverage(coverageRef.current, nextHistory);
            try {
              const committed = await store.commitSyncState(scope, {
                nextSyncEnvelope: reconciled.sync,
                nextCalendar: reconciled.calendar,
                ...(reconciled.dayChange ? { dayChange: reconciled.dayChange } : {}),
                coverage: nextCoverage,
                expectedSyncRevision: syncRevisionRef.current,
              });
              if (!isCurrentScope()) break;
              syncRevisionRef.current = committed.syncRevision;
              syncRef.current = reconciled.sync;
              calendarRef.current = reconciled.calendar;
              coverageRef.current = nextCoverage;
              setSyncEnvelope(reconciled.sync);
              setEnvelope(reconciled.calendar);
              setCoverageState(nextCoverage);
              setAccount(reconciled.sync.conflicts.length > 0
                ? { status: "conflict", ownerUserId }
                : { status: "saved", ownerUserId });
              acknowledged = true;
              if (nextHistory.status === "stale") setHistoryBackfillTrigger((value) => value + 1);
              break;
            } catch (error) {
              if (!isStaleSyncRevision(error) || attempt === 1) throw error;
              if (!await reloadActiveOwnerProjection(scope, token, store)) break;
            }
          }
          if (acknowledged && !(syncRef.current?.conflicts.length)) continue;
          break;
        }
        if (result.status === "conflict") {
          if (typeof result.remoteIdentity !== "string"
            || result.remoteCandidate === undefined
            || typeof result.remoteDeleted !== "boolean") {
            setMessage("Conflictul cloud nu conține snapshotul necesar unei rezolvări sigure.");
            setAccount({ status: "offline", ownerUserId });
            break;
          }
          const timestamp = new Date().toISOString();
          let equivalentAcknowledged = false;
          for (let attempt = 0; attempt < 2; attempt += 1) {
            const activeSync = syncRef.current;
            const activeCalendar = calendarRef.current;
            if (!activeSync || !activeCalendar || !isCurrentScope()) break;
            const reconciliation = reconcileCloudConflictOwnerProjection({
              calendar: activeCalendar,
              sync: activeSync,
              operationKey: operation.operationKey,
              remoteIdentity: result.remoteIdentity,
              remoteRevision: result.remoteRevision,
              remoteCandidate: result.remoteCandidate,
              remoteDeleted: result.remoteDeleted,
              reason: result.message,
              timestamp,
            });
            const currentHistory = readHistoryCoverage(coverageRef.current);
            const nextHistory = currentHistory.snapshotRevision === null
              ? currentHistory
              : markHistoryCoverageStale(currentHistory);
            const nextCoverage = withHistoryCoverage(coverageRef.current, nextHistory);
            try {
              const committed = await store.commitSyncState(scope, {
                nextSyncEnvelope: reconciliation.sync,
                nextCalendar: reconciliation.calendar,
                ...(reconciliation.dayChange ? { dayChange: reconciliation.dayChange } : {}),
                coverage: nextCoverage,
                expectedSyncRevision: syncRevisionRef.current,
              });
              if (!isCurrentScope()) break;
              syncRevisionRef.current = committed.syncRevision;
              syncRef.current = reconciliation.sync;
              calendarRef.current = reconciliation.calendar;
              coverageRef.current = nextCoverage;
              setSyncEnvelope(reconciliation.sync);
              setEnvelope(reconciliation.calendar);
              setCoverageState(nextCoverage);
              setAccount(reconciliation.hasConflict
                ? { status: "conflict", ownerUserId }
                : { status: "saved", ownerUserId });
              equivalentAcknowledged = reconciliation.resolution === "acknowledged_equivalent"
                && !reconciliation.hasConflict;
              if (nextHistory.status === "stale") setHistoryBackfillTrigger((value) => value + 1);
              break;
            } catch (error) {
              if (!isStaleSyncRevision(error) || attempt === 1) throw error;
              if (!await reloadActiveOwnerProjection(scope, token, store)) break;
            }
          }
          if (equivalentAcknowledged) continue;
          if (syncRef.current?.conflicts.some((conflict) => conflict.operationKey === operation.operationKey)) continue;
        } else if (result.status === "offline") {
          const timestamp = new Date().toISOString();
          const retrySync = markAccountOperationRetry(latest, operation.operationKey, { code: "OFFLINE" }, timestamp);
          const committed = await store.commitSyncState(scope, {
            nextSyncEnvelope: retrySync,
            expectedSyncRevision: syncRevisionRef.current,
          });
          if (!isCurrentScope()) break;
          syncRevisionRef.current = committed.syncRevision;
          syncRef.current = retrySync;
          setSyncEnvelope(retrySync);
          setAccount({ status: "offline", ownerUserId });
        } else if (result.status === "unauthenticated") {
          const anonymousScope = anonymousScopeRef.current;
          if (anonymousScope) void switchOwnerScopeRef.current(anonymousScope, null);
        } else if (result.permanent) {
          const timestamp = new Date().toISOString();
          const quarantined = quarantineAccountOperation(latest, operation.operationKey, {
            code: result.code,
            message: result.message,
          }, timestamp);
          const localOnlyChanges = getAccountOperationDependencies(operation)
            .filter((identity) => identity.startsWith("day:") || identity.startsWith("personal:"))
            .map((identity) => ({
              identity,
              reason: "cloud_operation_permanently_failed",
              updatedAt: timestamp,
            }));
          const committed = await store.commitSyncState(scope, {
            nextSyncEnvelope: quarantined,
            localOnlyChanges,
            expectedSyncRevision: syncRevisionRef.current,
          });
          if (!isCurrentScope()) break;
          syncRevisionRef.current = committed.syncRevision;
          syncRef.current = quarantined;
          setSyncEnvelope(quarantined);
          const failedMarkers = localOnlyChanges.map((marker) => ({ ...marker, scope: scope.key }));
          const failedIdentities = new Set(failedMarkers.map((marker) => marker.identity));
          publishLocalOnlyMarkers([
            ...localOnlyMarkersRef.current.filter((marker) => !failedIdentities.has(marker.identity)),
            ...failedMarkers,
          ]);
          setMessage(result.message);
          setAccount(quarantined.conflicts.length > 0
            ? { status: "conflict", ownerUserId }
            : { status: "offline", ownerUserId });
          continue;
        } else {
          const timestamp = new Date().toISOString();
          const retrySync = markAccountOperationRetry(latest, operation.operationKey, { code: result.code }, timestamp);
          const committed = await store.commitSyncState(scope, {
            nextSyncEnvelope: retrySync,
            expectedSyncRevision: syncRevisionRef.current,
          });
          if (!isCurrentScope()) break;
          syncRevisionRef.current = committed.syncRevision;
          syncRef.current = retrySync;
          setSyncEnvelope(retrySync);
          setMessage(result.message);
          setAccount({ status: "offline", ownerUserId });
        }
        break;
      }
    } catch (error) {
      if (isCurrentScope()) {
        if (isStaleSyncRevision(error)) await reloadActiveOwnerProjection(scope, token, store);
        setMessage(error instanceof Error ? error.message : "Sincronizarea locală nu a putut fi confirmată durabil.");
        setAccount({ status: "offline", ownerUserId });
      }
    } finally {
      flushInFlightScopesRef.current.delete(flushKey);
    }
  }, [publishLocalOnlyMarkers, reloadActiveOwnerProjection]);

  useEffect(() => {
    const scope = activeScopeRef.current;
    if (scope?.kind !== "authenticated" || !syncEnvelope?.outbox.length) return;
    void flushAccountOutbox(scope.ownerUserId);
  }, [connectivityGeneration, flushAccountOutbox, scopeGeneration, syncEnvelope?.conflicts.length, syncEnvelope?.outbox.length]);

  const createQueuedOperation = (
    current: Amv2AccountSyncEnvelope,
    scope: Amv2OwnerScope,
    type: Amv2OutboxOperation["type"],
    payload: Record<string, unknown>,
    remoteIdentity: string,
    createdAt: string,
  ) => {
    if (scope.kind !== "authenticated" || current.ownerUserId !== scope.ownerUserId) {
      throw new Error("Operația cloud nu corespunde partiției autentificate active.");
    }
    const operation: Amv2OutboxOperation = {
      ownerUserId: scope.ownerUserId,
      operationKey: makeLocalId("amv2-operation"),
      type,
      expectedRevision: current.remoteRevisions[remoteIdentity] ?? 0,
      payload,
      createdAt,
      delivery: { status: "pending", attempts: 0, lastCode: null, lastAttemptAt: null },
    };
    return { operation, sync: enqueueAccountOperation(current, operation, createdAt) };
  };

  const persistDay = async (date: string, day: WorkoutDay | null, timestamp: string, syncCloud = true) => {
    const scope = activeScopeRef.current;
    const token = activeScopeTokenRef.current;
    const store = durableStoreRef.current;
    const currentCalendar = calendarRef.current;
    const currentSync = syncRef.current;
    if (!scope || !token || !store || !currentCalendar || !currentSync || !storageReady) {
      setMessage("Stocarea locală nu este disponibilă. Datele existente au rămas neschimbate.");
      return false;
    }
    const nextCalendar = replaceWorkoutDayInCalendar(currentCalendar, date, day, timestamp);
    const referencesLocalPersonalExercise = day?.exercises.some((exercise) => exercise.reference.source === "personal"
      && localOnlyPersonalIdsRef.current.has(exercise.reference.personalExerciseId)) ?? false;
    const remoteIdentity = `day:${date}`;
    const hasRemoteRevision = (currentSync.remoteRevisions[remoteIdentity] ?? 0) > 0;
    const requiresExplicitImport = (localOnlyDayDatesRef.current.has(date) && !(day === null && hasRemoteRevision))
      || referencesLocalPersonalExercise;
    const expectedSyncRevision = syncRevisionRef.current;
    try {
      let nextSync = currentSync;
      let operation: Amv2OutboxOperation | null = null;
      if (scope.kind === "authenticated" && syncCloud && !requiresExplicitImport) {
        const queued = createQueuedOperation(
          currentSync,
          scope,
          day === null ? "delete_day" : "upsert_day",
          day === null ? { date } : serializeWorkoutDayForCloud(day),
          `day:${date}`,
          timestamp,
        );
        nextSync = queued.sync;
        operation = queued.operation;
      }
      const committed = await store.commitWorkoutDayMutation(scope, {
        date,
        day,
        nextCalendar,
        nextSyncEnvelope: nextSync,
        expectedCalendarRevision: currentCalendar.revision,
        expectedSyncRevision,
        timestamp,
        ...(operation
          ? { intent: { kind: "outbox" as const, operation } }
          : scope.kind === "authenticated"
            ? { localOnlyReason: requiresExplicitImport ? "explicit_import_required" : "cloud_sync_disabled" }
            : {}),
      });
      if (activeScopeRef.current?.key !== scope.key || !scopeCoordinatorRef.current.isCurrent(token)) return false;
      const alreadyCommitted = await reloadAlreadyCommittedMutation(committed.status, scope, token, store);
      if (!alreadyCommitted) {
        syncRevisionRef.current = committed.syncRevision;
        calendarRef.current = nextCalendar;
        syncRef.current = nextSync;
        setEnvelope(nextCalendar);
        setSyncEnvelope(nextSync);
      }
      const nextMarkers = localOnlyMarkersRef.current.filter((marker) => marker.identity !== `day:${date}`);
      if (scope.kind === "authenticated" && !operation && day !== null) {
        nextMarkers.push({
          scope: scope.key,
          identity: `day:${date}`,
          reason: requiresExplicitImport ? "explicit_import_required" : "cloud_sync_disabled",
          updatedAt: timestamp,
        });
      }
      publishLocalOnlyMarkers(nextMarkers);
      setMessage(null);
      if (scope.kind === "authenticated" && operation && account.status !== "offline" && account.status !== "conflict") {
        void flushAccountOutbox(scope.ownerUserId);
      }
      return true;
    } catch (error) {
      if (isStaleSyncRevision(error)) {
        await reloadActiveOwnerProjection(scope, token, store);
        setMessage("Ziua a fost actualizată în altă filă. Valorile din editor au rămas disponibile pentru reîncercare.");
        return false;
      }
      setMessage(error instanceof Error ? error.message : "Modificarea nu a putut fi salvată durabil.");
      return false;
    }
  };

  const selectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setMonthKey(monthKeyFromDateKey(dateKey));
    setScreen("day");
    setEditor(null);
    setHistoryIdentity(null);
    setMessage(null);
  };

  const selectToday = () => selectDate(todayDate);

  const openCatalog = () => {
    showScreen("catalog");
    setEditor(null);
    setMessage(null);
  };

  const openExerciseEditor = (exercise: WorkoutExercise) => {
    setEditor({ mode: "existing", exercise });
    showScreen("editor");
    setMessage(null);
  };

  const openStatistics = () => {
    setHistoryIdentity(null);
    showScreen("statistics");
    setMessage(null);
  };

  const openExerciseHistory = (identity: string, returnScreen: "day" | "editor" | "statistics") => {
    if (!findExerciseHistory(statistics, identity)) {
      setMessage("Istoricul exercițiului nu mai este disponibil.");
      return;
    }
    setHistoryIdentity(identity);
    setHistoryReturnScreen(returnScreen);
    showScreen("history");
    setMessage(null);
  };

  const closeExerciseHistory = () => {
    const nextScreen = historyReturnScreen;
    setHistoryIdentity(null);
    showScreen(nextScreen);
  };

  const selectCatalogExercise = (exerciseKey: string) => {
    const existing = selectedDay?.exercises.find((exercise) => exercise.reference.source === "canonical"
      && exercise.reference.exerciseKey === exerciseKey);
    if (existing) {
      openExerciseEditor(existing);
      return;
    }
    if ((selectedDay?.exercises.length ?? 0) >= WORKOUT_DAY_LIMITS.exercises.max) {
      setMessage("Ziua selectată poate conține maximum 10 exerciții.");
      return;
    }
    try {
      const exerciseId = makeLocalId("amv2-day-exercise");
      const metric = resolveCanonicalExerciseMetric(exerciseKey);
      const input: { exerciseId: string; exerciseKey: string; setIds?: string[] } = {
        exerciseId,
        exerciseKey,
      };
      if (metric.metric_type !== "total_duration") {
        input.setIds = [1, 2, 3].map((ordinal) => `${exerciseId}-set-${ordinal}`);
      }
      const exercise = createWorkoutDayExercise(input);
      setEditor({ mode: "new", exercise });
      showScreen("editor");
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Exercițiul nu a putut fi deschis.");
    }
  };

  const selectPersonalCatalogExercise = (personalExerciseId: string) => {
    const personal = activePersonalExercises.find((candidate) => candidate.id === personalExerciseId);
    if (!personal) {
      setMessage("Exercițiul personal nu mai este activ.");
      return;
    }
    const existing = selectedDay?.exercises.find((exercise) => exercise.reference.source === "personal"
      && exercise.reference.personalExerciseId === personalExerciseId);
    if (existing) {
      openExerciseEditor(existing);
      return;
    }
    if ((selectedDay?.exercises.length ?? 0) >= WORKOUT_DAY_LIMITS.exercises.max) {
      setMessage("Ziua selectată poate conține maximum 10 exerciții.");
      return;
    }
    try {
      const exerciseId = makeLocalId("amv2-day-exercise");
      const metric = resolveCanonicalExerciseMetric(personal.templateExerciseKey);
      const exercise = createPersonalWorkoutDayExercise({
        exerciseId,
        personalExerciseId: personal.id,
        templateExerciseKey: personal.templateExerciseKey,
        displayName: personal.name,
        category: personal.category,
        ...(metric.metric_type === "total_duration"
          ? {}
          : { setIds: [1, 2, 3].map((ordinal) => `${exerciseId}-set-${ordinal}`) }),
      });
      setEditor({ mode: "new", exercise });
      showScreen("editor");
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Exercițiul personal nu a putut fi deschis.");
    }
  };

  const openNewPersonalExercise = () => {
    setCatalogSource("personal");
    setPersonalEditor(null);
    showScreen("personal");
    setMessage(null);
  };

  const openPersonalExerciseSettings = (personalExerciseId: string) => {
    const personal = activePersonalExercises.find((candidate) => candidate.id === personalExerciseId);
    if (!personal) return;
    setCatalogSource("personal");
    setPersonalEditor(personal);
    showScreen("personal");
    setMessage(null);
  };

  const savePersonalExercise = async (input: {
    name: string;
    category: string;
    metricType: "repetitions_weight" | "repetitions_only" | "time_per_set";
  }) => {
    const current = syncRef.current;
    const scope = activeScopeRef.current;
    const token = activeScopeTokenRef.current;
    const store = durableStoreRef.current;
    if (!current || !scope || !token || !store) return;
    const timestamp = new Date().toISOString();
    try {
      const personal = personalEditor
        ? updatePersonalExercise(personalEditor, {
            name: input.name,
            category: input.category,
            metricType: input.metricType,
            timestamp,
          })
        : createPersonalExercise({
            id: makeLocalId("amv2-personal"),
            clientKey: makeLocalId("amv2-personal-client"),
            name: input.name,
            category: input.category,
            metricType: input.metricType,
            timestamp,
          });
      const alreadyLocalOnly = localOnlyPersonalIdsRef.current.has(personal.id);
      let nextSync = replacePersonalExerciseInSync(current, personal, timestamp);
      let operation: Amv2OutboxOperation | null = null;
      if (scope.kind === "authenticated" && !alreadyLocalOnly) {
        const queued = createQueuedOperation(
          nextSync,
          scope,
          "upsert_personal",
          serializePersonalExerciseForCloud(personal),
          `personal:${personal.id}`,
          timestamp,
        );
        nextSync = queued.sync;
        operation = queued.operation;
      }
      const committed = await store.commitPersonalMutation(scope, {
        nextPersonal: personal,
        nextSyncEnvelope: nextSync,
        expectedSyncRevision: syncRevisionRef.current,
        timestamp,
        ...(operation
          ? { intent: { kind: "outbox" as const, operation } }
          : scope.kind === "authenticated"
            ? { localOnlyReason: "explicit_import_required" }
            : {}),
      });
      if (activeScopeRef.current?.key !== scope.key || !scopeCoordinatorRef.current.isCurrent(token)) return;
      const alreadyCommitted = await reloadAlreadyCommittedMutation(committed.status, scope, token, store);
      if (!alreadyCommitted) {
        syncRevisionRef.current = committed.syncRevision;
        syncRef.current = nextSync;
        setSyncEnvelope(nextSync);
      }
      const nextMarkers = localOnlyMarkersRef.current.filter((marker) => marker.identity !== `personal:${personal.id}`);
      if (scope.kind === "authenticated" && !operation) {
        nextMarkers.push({ scope: scope.key, identity: `personal:${personal.id}`, reason: "explicit_import_required", updatedAt: timestamp });
      }
      publishLocalOnlyMarkers(nextMarkers);
      setCatalogSource("personal");
      showScreen("catalog");
      setPersonalEditor(undefined);
      setMessage(null);
      if (scope.kind === "authenticated" && operation && account.status !== "offline" && account.status !== "conflict") {
        void flushAccountOutbox(scope.ownerUserId);
      }
    } catch (error) {
      if (isStaleSyncRevision(error)) await reloadActiveOwnerProjection(scope, token, store);
      setMessage(error instanceof Error ? error.message : "Exercițiul personal nu a putut fi salvat.");
    }
  };

  const archivePersonal = async (personalExerciseId: string) => {
    const current = syncRef.current;
    const personal = current?.personalExercises.find((candidate) => candidate.id === personalExerciseId);
    const scope = activeScopeRef.current;
    const token = activeScopeTokenRef.current;
    const store = durableStoreRef.current;
    if (!current || !personal || !scope || !token || !store) return;
    const timestamp = new Date().toISOString();
    try {
      const archived = archivePersonalExercise(personal, timestamp);
      const wasLocalOnly = localOnlyPersonalIdsRef.current.has(archived.id);
      let nextSync = replacePersonalExerciseInSync(current, archived, timestamp);
      let operation: Amv2OutboxOperation | null = null;
      if (scope.kind === "authenticated" && !wasLocalOnly) {
        const queued = createQueuedOperation(nextSync, scope, "archive_personal", { id: archived.id }, `personal:${archived.id}`, timestamp);
        nextSync = queued.sync;
        operation = queued.operation;
      }
      const committed = await store.commitPersonalMutation(scope, {
        nextPersonal: archived,
        nextSyncEnvelope: nextSync,
        expectedSyncRevision: syncRevisionRef.current,
        timestamp,
        ...(operation
          ? { intent: { kind: "outbox" as const, operation } }
          : scope.kind === "authenticated"
            ? { localOnlyReason: "archived_local_definition" }
            : {}),
      });
      if (activeScopeRef.current?.key !== scope.key || !scopeCoordinatorRef.current.isCurrent(token)) return;
      const alreadyCommitted = await reloadAlreadyCommittedMutation(committed.status, scope, token, store);
      if (!alreadyCommitted) {
        syncRevisionRef.current = committed.syncRevision;
        syncRef.current = nextSync;
        setSyncEnvelope(nextSync);
      }
      publishLocalOnlyMarkers(localOnlyMarkersRef.current.filter((marker) => marker.identity !== `personal:${archived.id}`));
      if (scope.kind === "authenticated" && operation && account.status !== "offline" && account.status !== "conflict") {
        void flushAccountOutbox(scope.ownerUserId);
      }
    } catch (error) {
      if (isStaleSyncRevision(error)) await reloadActiveOwnerProjection(scope, token, store);
      setMessage(error instanceof Error ? error.message : "Exercițiul personal nu a putut fi arhivat.");
    }
  };

  const keepLocalAfterConflict = async () => {
    const current = syncRef.current;
    const ownerUserId = "ownerUserId" in account ? account.ownerUserId : undefined;
    const conflict = current?.conflicts[0];
    if (!current || !ownerUserId || !conflict) return;
    try {
      const next = resolveAccountConflictWithLocal(current, conflict.operationKey, new Date().toISOString());
      if (!await commitSyncEnvelope(next)) return;
      setAccount(next.conflicts.length > 0
        ? { status: "conflict", ownerUserId }
        : { status: "authenticated", ownerUserId });
      if (next.conflicts.length === 0) {
        setHistoryBackfillTrigger((value) => value + 1);
        void flushAccountOutbox(ownerUserId);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Conflictul nu a putut fi reluat.");
    }
  };

  const adoptRemoteAfterConflict = async () => {
    const current = syncRef.current;
    const currentCalendar = calendarRef.current;
    const conflict = current?.conflicts[0];
    const scope = activeScopeRef.current;
    const token = activeScopeTokenRef.current;
    const store = durableStoreRef.current;
    if (!current || !currentCalendar || !conflict || !scope || scope.kind !== "authenticated" || !token || !store) return;
    try {
      const resolved = adoptRemoteConflictProjection({
        calendar: currentCalendar,
        sync: current,
        conflictId: conflict.id,
        timestamp: new Date().toISOString(),
      });
      const committed = await store.commitSyncState(scope, {
        nextSyncEnvelope: resolved.sync,
        nextCalendar: resolved.calendar,
        ...(resolved.dayChange ? { dayChange: resolved.dayChange } : {}),
        expectedSyncRevision: syncRevisionRef.current,
      });
      if (activeScopeRef.current?.key !== scope.key || !scopeCoordinatorRef.current.isCurrent(token)) return;
      syncRevisionRef.current = committed.syncRevision;
      calendarRef.current = resolved.calendar;
      syncRef.current = resolved.sync;
      setEnvelope(resolved.calendar);
      setSyncEnvelope(resolved.sync);
      setAccount(resolved.sync.conflicts.length > 0
        ? { status: "conflict", ownerUserId: scope.ownerUserId }
        : { status: "authenticated", ownerUserId: scope.ownerUserId });
      setMessage(null);
      if (resolved.sync.conflicts.length === 0) setHistoryBackfillTrigger((value) => value + 1);
      if (resolved.sync.outbox.length > 0) void flushAccountOutbox(scope.ownerUserId);
    } catch (error) {
      if (isStaleSyncRevision(error)) await reloadActiveOwnerProjection(scope, token, store);
      setMessage(error instanceof Error ? error.message : "Versiunea din cont nu a putut fi adoptată.");
    }
  };

  const importPersonalExercisesIntoAccount = async () => {
    const scope = activeScopeRef.current;
    const token = activeScopeTokenRef.current;
    const store = durableStoreRef.current;
    if (!scope || scope.kind !== "authenticated" || !token || !store) return;
    try {
      for (const personalId of [...localOnlyPersonalIdsRef.current]) {
        const current = syncRef.current;
        const personal = current?.personalExercises.find((exercise) => exercise.id === personalId && exercise.archivedAt === null);
        if (!current || !personal) continue;
        const timestamp = new Date().toISOString();
        const queued = createQueuedOperation(current, scope, "upsert_personal", serializePersonalExerciseForCloud(personal), `personal:${personal.id}`, timestamp);
        const committed = await store.commitPersonalMutation(scope, {
          nextPersonal: personal,
          nextSyncEnvelope: queued.sync,
          expectedSyncRevision: syncRevisionRef.current,
          timestamp,
          intent: { kind: "outbox", operation: queued.operation },
        });
        if (activeScopeRef.current?.key !== scope.key || !scopeCoordinatorRef.current.isCurrent(token)) return;
        const alreadyCommitted = await reloadAlreadyCommittedMutation(committed.status, scope, token, store);
        if (!alreadyCommitted) {
          syncRevisionRef.current = committed.syncRevision;
          syncRef.current = queued.sync;
          setSyncEnvelope(queued.sync);
        }
        publishLocalOnlyMarkers(localOnlyMarkersRef.current.filter((marker) => marker.identity !== `personal:${personal.id}`));
      }
      if (account.status !== "offline" && account.status !== "conflict") void flushAccountOutbox(scope.ownerUserId);
    } catch (error) {
      if (isStaleSyncRevision(error)) await reloadActiveOwnerProjection(scope, token, store);
      setMessage(error instanceof Error ? error.message : "Exercițiile personale nu au putut fi pregătite pentru sincronizare.");
    }
  };

  const importSelectedDayIntoAccount = async () => {
    const scope = activeScopeRef.current;
    const token = activeScopeTokenRef.current;
    const store = durableStoreRef.current;
    if (!selectedDay || !scope || scope.kind !== "authenticated" || !token || !store) return;
    try {
      for (const reference of selectedDay.exercises.flatMap((exercise) => exercise.reference.source === "personal"
        ? [exercise.reference.personalExerciseId]
        : [])) {
        if (!localOnlyPersonalIdsRef.current.has(reference)) continue;
        const current = syncRef.current;
        const personal = current?.personalExercises.find((candidate) => candidate.id === reference && candidate.archivedAt === null);
        if (!current || !personal) throw new Error("Ziua folosește un exercițiu personal arhivat care nu poate fi importat automat în cont.");
        const timestamp = new Date().toISOString();
        const queued = createQueuedOperation(current, scope, "upsert_personal", serializePersonalExerciseForCloud(personal), `personal:${personal.id}`, timestamp);
        const committed = await store.commitPersonalMutation(scope, {
          nextPersonal: personal,
          nextSyncEnvelope: queued.sync,
          expectedSyncRevision: syncRevisionRef.current,
          timestamp,
          intent: { kind: "outbox", operation: queued.operation },
        });
        if (activeScopeRef.current?.key !== scope.key || !scopeCoordinatorRef.current.isCurrent(token)) return;
        const alreadyCommitted = await reloadAlreadyCommittedMutation(committed.status, scope, token, store);
        if (!alreadyCommitted) {
          syncRevisionRef.current = committed.syncRevision;
          syncRef.current = queued.sync;
          setSyncEnvelope(queued.sync);
        }
        publishLocalOnlyMarkers(localOnlyMarkersRef.current.filter((marker) => marker.identity !== `personal:${personal.id}`));
      }
      const current = syncRef.current;
      const currentCalendar = calendarRef.current;
      if (!current || !currentCalendar) return;
      const timestamp = new Date().toISOString();
      const queued = createQueuedOperation(current, scope, "upsert_day", serializeWorkoutDayForCloud(selectedDay), `day:${selectedDay.date}`, timestamp);
      const nextCalendar = replaceWorkoutDayInCalendar(currentCalendar, selectedDay.date, selectedDay, timestamp);
      const committed = await store.commitWorkoutDayMutation(scope, {
        date: selectedDay.date,
        day: selectedDay,
        nextCalendar,
        nextSyncEnvelope: queued.sync,
        expectedCalendarRevision: currentCalendar.revision,
        expectedSyncRevision: syncRevisionRef.current,
        timestamp,
        intent: { kind: "outbox", operation: queued.operation },
      });
      if (activeScopeRef.current?.key !== scope.key || !scopeCoordinatorRef.current.isCurrent(token)) return;
      const alreadyCommitted = await reloadAlreadyCommittedMutation(committed.status, scope, token, store);
      if (!alreadyCommitted) {
        syncRevisionRef.current = committed.syncRevision;
        calendarRef.current = nextCalendar;
        syncRef.current = queued.sync;
        setEnvelope(nextCalendar);
        setSyncEnvelope(queued.sync);
      }
      publishLocalOnlyMarkers(localOnlyMarkersRef.current.filter((marker) => marker.identity !== `day:${selectedDay.date}`));
      if (account.status !== "offline" && account.status !== "conflict") void flushAccountOutbox(scope.ownerUserId);
    } catch (error) {
      if (isStaleSyncRevision(error)) await reloadActiveOwnerProjection(scope, token, store);
      setMessage(error instanceof Error ? error.message : "Ziua nu a putut fi pregătită pentru sincronizare.");
    }
  };

  const saveExercise = async (exercise: WorkoutExercise) => {
    if (!editor || !selectedDate) return;
    const timestamp = new Date().toISOString();
    try {
      const nextDay = editor.mode === "new"
        ? addExerciseToWorkoutDay(selectedDay, {
            date: selectedDate,
            location: selectedLocation,
            exercise,
            timestamp,
          })
        : updateWorkoutDayExercise(selectedDay as WorkoutDay, exercise, timestamp);
      if (!await persistDay(selectedDate, nextDay, timestamp)) return;
      showScreen("day");
      setEditor(null);
    } catch (error) {
      setMessage(error instanceof WorkoutDayDomainError ? error.message : "Exercițiul nu a putut fi salvat.");
    }
  };

  const deleteExercise = async (exerciseIdentity: string) => {
    if (!selectedDay || !selectedDate) return;
    const timestamp = new Date().toISOString();
    try {
      const nextDay = removeExerciseFromWorkoutDay(selectedDay, exerciseIdentity, timestamp);
      await persistDay(selectedDate, nextDay, timestamp);
    } catch (error) {
      setMessage(error instanceof WorkoutDayDomainError ? error.message : "Exercițiul nu a putut fi șters.");
    }
  };

  const openV1Import = () => {
    setV1Source(readV1CompatibilitySource(window.localStorage));
    showScreen("v1-import");
    setMessage(null);
  };

  const importV1Workout = async (workout: unknown) => {
    if (!selectedDate || selectedDay) return;
    const scope = activeScopeRef.current;
    const token = activeScopeTokenRef.current;
    const store = durableStoreRef.current;
    const currentCalendar = calendarRef.current;
    const currentSync = syncRef.current;
    if (!scope || !token || !store || !currentCalendar || !currentSync) return;
    const timestamp = new Date().toISOString();
    try {
      const day = copyV1WorkoutIntoDate({
        workout,
        existingDay: null,
        date: selectedDate,
        timestamp,
        idFactory: (kind) => makeLocalId(`amv2-v1-${kind}`),
      });
      const nextCalendar = replaceWorkoutDayInCalendar(currentCalendar, selectedDate, day, timestamp);
      const batchId = makeLocalId("amv2-v1-import");
      const rawSourceIdentity = typeof (workout as { id?: unknown }).id === "string"
        ? (workout as { id: string }).id
        : batchId;
      const sourceDefinitionIdentity = `v1-definition:${rawSourceIdentity}`;
      const sourceOccurrenceIdentity = `v1-occurrence:${rawSourceIdentity}:${selectedDate}`;
      const batch = {
        id: batchId,
        source: "v1_local",
        status: "completed",
        importedDate: selectedDate,
        sourceDefinitionIdentity,
        sourceOccurrenceIdentity,
      };
      let nextSync = recordImportBatch(currentSync, batch, timestamp);
      let operation: Amv2OutboxOperation | null = null;
      if (scope.kind === "authenticated") {
        const queued = createQueuedOperation(nextSync, scope, "import_days", {
          batchKey: batchId,
          source: "v1_local",
          sourceDefinitionIdentity,
          sourceOccurrenceIdentity,
          destinationDate: selectedDate,
          days: [serializeWorkoutDayForCloud(day)],
        }, `import:${sourceOccurrenceIdentity}`, timestamp);
        nextSync = queued.sync;
        operation = queued.operation;
      }
      const committed = await store.commitWorkoutDayMutation(scope, {
        date: selectedDate,
        day,
        nextCalendar,
        nextSyncEnvelope: nextSync,
        expectedCalendarRevision: currentCalendar.revision,
        expectedSyncRevision: syncRevisionRef.current,
        timestamp,
        ...(operation ? { intent: { kind: "outbox" as const, operation } } : {}),
      });
      if (activeScopeRef.current?.key !== scope.key || !scopeCoordinatorRef.current.isCurrent(token)) return;
      const alreadyCommitted = await reloadAlreadyCommittedMutation(committed.status, scope, token, store);
      if (!alreadyCommitted) {
        syncRevisionRef.current = committed.syncRevision;
        calendarRef.current = nextCalendar;
        syncRef.current = nextSync;
        setEnvelope(nextCalendar);
        setSyncEnvelope(nextSync);
      }
      publishLocalOnlyMarkers(localOnlyMarkersRef.current.filter((marker) => marker.identity !== `day:${selectedDate}`));
      showScreen("day");
      setV1Source(null);
      if (scope.kind === "authenticated" && operation && account.status !== "offline" && account.status !== "conflict") {
        void flushAccountOutbox(scope.ownerUserId);
      }
    } catch (error) {
      if (isStaleSyncRevision(error)) await reloadActiveOwnerProjection(scope, token, store);
      setMessage(error instanceof Error ? error.message : "Definiția V1 nu poate fi copiată fără presupuneri.");
    }
  };

  const closeTransientScreen = () => {
    showScreen("day");
    setEditor(null);
    setPersonalEditor(undefined);
    setV1Source(null);
    setHistoryIdentity(null);
    setMessage(null);
  };

  const goBack = () => {
    if (screen === "history") {
      closeExerciseHistory();
      return;
    }
    if (screen === "statistics") {
      showScreen("day");
      return;
    }
    if (screen === "personal" || screen === "v1-import" || (screen === "editor" && editor?.mode === "new")) {
      showScreen("catalog");
      setPersonalEditor(undefined);
      setV1Source(null);
      setMessage(null);
      return;
    }
    closeTransientScreen();
  };

  if (!envelope || !selectedDate || !monthKey || !todayDate) {
    return (
      <div className={styles.page} data-amv2-checkpoint="cp219p">
        <Amv2Header />
        <main className={styles.loadingState}>Se deschide calendarul local…</main>
      </div>
    );
  }

  return (
    <div
      className={styles.page}
      data-amv2-route="calendar-workout-log"
      data-amv2-checkpoint="cp219p"
      data-local-model="workout-day-v1"
    >
      <Amv2Header />
      {screen !== "day" && screen !== "statistics" && screen !== "history" ? (
        <div className={styles.finalToolbar}>
          <button type="button" onClick={goBack}><span aria-hidden="true">‹</span> Înapoi</button>
          <strong>{formatSelectedDate(selectedDate)}</strong>
        </div>
      ) : null}

      <main className={`${styles.main} ${styles.calendarMain}`} data-screen={screen}>
        {screen === "day" ? (
          <div className={styles.dayOnly}>
            <Amv2Hero />
            <MonthlyWorkoutCalendar
              monthKey={monthKey}
              selectedDate={selectedDate}
              todayDate={todayDate}
              days={envelope.days}
              onPreviousMonth={() => setMonthKey((current) => shiftMonthKey(current, -1))}
              onNextMonth={() => setMonthKey((current) => shiftMonthKey(current, 1))}
              onToday={selectToday}
              onSelectDate={selectDate}
            />
            <StatisticsLauncher
              statistics={statistics}
              complete={historyProjectionComplete}
              onOpen={openStatistics}
            />
          </div>
        ) : null}

        {screen === "statistics" ? (
          <StatisticsView
            statistics={statistics}
            complete={historyProjectionComplete}
            onBack={() => showScreen("day")}
            onOpenExercise={(identity) => openExerciseHistory(identity, "statistics")}
          />
        ) : screen === "history" ? (
          <ExerciseHistoryView
            history={selectedHistory}
            complete={historyProjectionComplete}
            onBack={closeExerciseHistory}
          />
        ) : (
        <section className={screen === "day" ? styles.finalDaySection : styles.transientSection} aria-labelledby="amv2-selected-date">
          {screen === "day" ? (
            <>
              <header className={styles.selectedDayHeader}>
                <h2 id="amv2-selected-date">{formatSelectedDate(selectedDate)}</h2>
              </header>

              {selectedGroups.length > 0 ? (
                <div className={styles.selectedDayBadges} aria-label="Categorii">
                  {selectedGroups.map((group) => <ExerciseCategoryBadge key={group.id} category={group.label} />)}
                </div>
              ) : null}
            </>
          ) : null}

          {message ? <p className={styles.inlineError} role="alert">{message}</p> : null}
          {account.status === "conflict" ? (
            <div className={styles.syncConflict} role="status">
              <span>Versiunea locală a rămas intactă. Confirmă numai dacă vrei să o păstrezi în cont.</span>
              <div>
                <button type="button" onClick={keepLocalAfterConflict}>Păstrează versiunea locală</button>
                <button type="button" onClick={adoptRemoteAfterConflict}>Folosește versiunea din cont</button>
              </div>
            </div>
          ) : null}

          {screen === "catalog" ? (
            <AddExercisesPanel
              source={catalogSource}
              onSourceChange={setCatalogSource}
              existingExerciseKeys={selectedDay?.exercises.flatMap((exercise) => exercise.reference.source === "canonical"
                ? [exercise.reference.exerciseKey]
                : []) ?? []}
              existingPersonalExerciseIds={selectedDay?.exercises.flatMap((exercise) => exercise.reference.source === "personal"
                ? [exercise.reference.personalExerciseId]
                : []) ?? []}
              personalExercises={activePersonalExercises}
              capacityFull={(selectedDay?.exercises.length ?? 0) >= WORKOUT_DAY_LIMITS.exercises.max}
              onSelectExercise={selectCatalogExercise}
              onSelectPersonalExercise={selectPersonalCatalogExercise}
              onCreatePersonalExercise={openNewPersonalExercise}
              onEditPersonalExercise={openPersonalExerciseSettings}
              onArchivePersonalExercise={archivePersonal}
              localOnlyPersonalCount={("ownerUserId" in account && account.ownerUserId) ? localOnlyPersonalIds.size : 0}
              onImportPersonalExercises={importPersonalExercisesIntoAccount}
              onOpenV1Import={openV1Import}
              playableExerciseKeys={playableExerciseKeys}
            />
          ) : screen === "personal" ? (
            <PersonalExerciseEditor
              key={personalEditor?.id ?? "new-personal"}
              existing={personalEditor ?? null}
              onSave={savePersonalExercise}
              onCancel={() => {
                setCatalogSource("personal");
                showScreen("catalog");
              }}
            />
          ) : screen === "v1-import" && v1Source ? (
            <V1ImportPanel
              workouts={v1Source.workouts}
              history={v1Source.history}
              destinationOccupied={selectedDay !== null}
              onImport={importV1Workout}
              onCancel={() => showScreen("catalog")}
            />
          ) : screen === "editor" && editor ? (
            <EditableExerciseCard
              key={`${editor.mode}-${editor.exercise.id}`}
              exercise={editor.exercise}
              mode={editor.mode}
              onSave={saveExercise}
              onCancel={closeTransientScreen}
              recentOccurrences={editorRecentOccurrences}
              recentHistoryComplete={historyProjectionComplete}
              onOpenHistory={editorHistory ? (working) => {
                setEditor((current) => current ? { ...current, exercise: working } : current);
                openExerciseHistory(editorHistory.identity, "editor");
              } : undefined}
              playableExerciseKeys={playableExerciseKeys}
            />
          ) : selectedDay ? (
            <div className={styles.populatedDay}>
              <div className={styles.exerciseList} aria-label="Exercițiile zilei selectate">
                {selectedDay.exercises.map((exercise) => (
                  <WorkoutDayExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    onEdit={() => openExerciseEditor(exercise)}
                    onDelete={() => deleteExercise(getWorkoutExerciseIdentity(exercise) as string)}
                    onOpenHistory={() => openExerciseHistory(getWorkoutExerciseIdentity(exercise) as string, "day")}
                    playableExerciseKeys={playableExerciseKeys}
                  />
                ))}
              </div>
              <button className={styles.addExerciseOutline} type="button" onClick={openCatalog}>
                <span aria-hidden="true">+</span> Adaugă exercițiu
              </button>
              {localOnlyDayDates.has(selectedDate) && "ownerUserId" in account && account.ownerUserId ? (
                <button className={styles.accountImportLink} type="button" onClick={importSelectedDayIntoAccount}>Salvează explicit ziua în cont</button>
              ) : null}
              {selectedDay.exercises.length >= WORKOUT_DAY_LIMITS.exercises.max ? (
                <p className={styles.capacityHint}>Ai ajuns la limita de 10 exerciții pentru această zi.</p>
              ) : null}
            </div>
          ) : (
            <div className={styles.emptyDay}>
              <h3>Niciun exercițiu înregistrat</h3>
              <p>Apasă pe butonul de mai jos pentru a începe</p>
              <button className={styles.addExerciseOutline} type="button" onClick={openCatalog}>
                <span aria-hidden="true">+</span> Adaugă exercițiu
              </button>
            </div>
          )}
        </section>
        )}
      </main>
    </div>
  );
}
