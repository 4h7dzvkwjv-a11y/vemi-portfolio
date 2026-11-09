"use client";

import { useState } from "react";
import type { WorkoutSession } from "@/lib/amv2/session-domain.mjs";
import { getSessionElapsedSeconds } from "@/lib/amv2/session-domain.mjs";
import styles from "./amv2.module.css";

const HISTORY_PAGE_SIZE = 5;

const formatDateTime = (value: string) => new Intl.DateTimeFormat("ro-RO", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

const formatElapsed = (session: WorkoutSession) => {
  const seconds = getSessionElapsedSeconds(session);
  if (seconds < 60) return "sub un minut";
  const minutes = Math.floor(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minut" : "minute"}`;
};

type HistoryListProps = {
  sessions: readonly WorkoutSession[];
  onOpen: (sessionId: string) => void;
  onBackToCreator: () => void;
};

export function CompletedHistoryView({ sessions, onOpen, onBackToCreator }: HistoryListProps) {
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);
  const visibleSessions = sessions.slice(0, visibleCount);

  return (
    <main className={styles.main} data-amv2-view="history">
      <section className={styles.sessionHero}>
        <span className={styles.eyebrow}>Istoric local</span>
        <h1>Antrenamente încheiate</h1>
        <p>Intrările sunt instantanee locale imuabile ale momentului finalizării.</p>
      </section>

      {visibleSessions.length === 0 ? (
        <section className={styles.historyEmpty}>
          <h2>Istoricul este încă gol</h2>
          <p>Primul antrenament finalizat va apărea aici.</p>
        </section>
      ) : (
        <section className={styles.historyList} aria-label="Antrenamente finalizate">
          {visibleSessions.map((session) => (
            <button key={session.id} type="button" onClick={() => onOpen(session.id)}>
              <span>
                <strong>{session.workoutName}</strong>
                <small>{formatDateTime(session.completedAt ?? session.lastUpdatedAt)}</small>
              </span>
              <span>
                <b>{session.exercises.length} exerciții</b>
                <small>{formatElapsed(session)}</small>
              </span>
              <i aria-hidden="true">›</i>
            </button>
          ))}
        </section>
      )}

      {visibleCount < sessions.length ? (
        <button
          className={styles.secondaryAction}
          type="button"
          onClick={() => setVisibleCount((count) => count + HISTORY_PAGE_SIZE)}
        >
          Încarcă mai multe
        </button>
      ) : null}
      <button className={styles.secondaryAction} type="button" onClick={onBackToCreator}>
        Înapoi la Creator
      </button>
    </main>
  );
}

type HistoryDetailProps = {
  session: WorkoutSession;
  onBack: () => void;
};

export function HistoryDetailView({ session, onBack }: HistoryDetailProps) {
  return (
    <main className={styles.main} data-amv2-view="history-detail">
      <button className={styles.detailBack} type="button" onClick={onBack}>‹ Înapoi la istoric</button>
      <section className={styles.sessionHero}>
        <span className={styles.eyebrow}>Antrenament finalizat</span>
        <h1>{session.workoutName}</h1>
        <p>{formatDateTime(session.completedAt ?? session.lastUpdatedAt)} · {formatElapsed(session)}</p>
      </section>

      <section className={styles.historyDetailList} aria-label="Detaliile antrenamentului finalizat">
        {session.exercises.map((exercise, exerciseIndex) => (
          <article key={exercise.id} data-history-exercise={exercise.reference.exerciseKey}>
            <header>
              <span>{String(exerciseIndex + 1).padStart(2, "0")}</span>
              <div><h2>{exercise.displayName}</h2><small>{exercise.category}</small></div>
            </header>
            {exercise.metricType === "total_duration" ? (
              <dl className={styles.historyValues}>
                <div><dt>Țintă</dt><dd>{exercise.targetTotalDurationSeconds} sec</dd></div>
                <div><dt>Efectuat</dt><dd>{exercise.actualTotalDurationSeconds} sec</dd></div>
              </dl>
            ) : (
              <div className={styles.historySets}>
                {exercise.sets.map((set, setIndex) => (
                  <div key={set.id}>
                    <strong>Seria {setIndex + 1}</strong>
                    {exercise.metricType === "repetitions_weight" ? (
                      <span>Țintă {set.targetRepetitions} × {set.targetWeightKg} kg · Efectuat {set.actualRepetitions} × {set.actualWeightKg} kg</span>
                    ) : exercise.metricType === "repetitions_only" ? (
                      <span>Țintă {set.targetRepetitions} repetări · Efectuat {set.actualRepetitions}</span>
                    ) : (
                      <span>Țintă {set.targetDurationSeconds} sec · Efectuat {set.actualDurationSeconds} sec</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
