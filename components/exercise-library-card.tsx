"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type {
  ExerciseCollectionMembership,
  TrainingPlace,
} from "../lib/exercises/catalog-model";

type ExerciseLibraryCardProps = {
  index: number;
  exerciseKey: string;
  name: string;
  category: string;
  places: TrainingPlace[];
  memberships: ExerciseCollectionMembership[];
  recommendedTarget: string;
  guidance1: string;
  guidance2: string;
  videoAction: ReactNode;
};

function RepetitionIcon() {
  return (
    <Image
      className="public-exercise-repetition-icon"
      src="/assets/exercise-repetition-logo.png"
      alt=""
      width={535}
      height={297}
      unoptimized
      draggable={false}
      aria-hidden="true"
      style={{ objectFit: "contain" }}
    />
  );
}

function HomeLocationIcon() {
  return (
    <svg className="public-exercise-location-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="m4 15 12-10 12 10M7 13v14h18V13M13 27v-8h6v8" />
    </svg>
  );
}

function GymLocationIcon() {
  return (
    <Image
      className="public-exercise-location-icon"
      src="/assets/gym-location-icon.png"
      alt=""
      width={215}
      height={172}
      unoptimized
      draggable={false}
      aria-hidden="true"
      style={{ objectFit: "contain" }}
    />
  );
}

function LocationItem({ place }: { place: TrainingPlace }) {
  const atHome = place === "acasa";

  return (
    <span className="public-exercise-location-item">
      {atHome ? <HomeLocationIcon /> : <GymLocationIcon />}
      <strong>{atHome ? "Acasă" : "La sală"}</strong>
    </span>
  );
}

export function ExerciseLibraryCard({
  index,
  exerciseKey,
  name,
  category,
  places,
  memberships,
  recommendedTarget,
  guidance1,
  guidance2,
  videoAction,
}: ExerciseLibraryCardProps) {
  return (
    <article
      className="public-exercise-card"
      data-exercise-key={exerciseKey}
      data-memberships={memberships.map((membership) => `${membership.collectionKey}:${membership.orderIndex}`).join(",")}
    >
      <div className="public-exercise-card-top">
        <span className="public-exercise-number">{String(index + 1).padStart(2, "0")}</span>
        <span className="public-exercise-group">{category}</span>
      </div>

      <h3>{name}</h3>

      <div className="public-exercise-recommendations">
        <div className="public-exercise-recommendations-title">
          <span>Recomandări</span>
        </div>

        <div className="public-exercise-target">
          <RepetitionIcon />
          <strong>{recommendedTarget}</strong>
        </div>

        <ul className="public-exercise-guidance">
          <li><span aria-hidden="true">✓</span><p>{guidance1}</p></li>
          <li><span aria-hidden="true">✓</span><p>{guidance2}</p></li>
        </ul>
      </div>

      <footer className="public-exercise-card-footer">
        <div className="public-exercise-location">
          {places.includes("acasa") ? <LocationItem place="acasa" /> : null}
          {places.includes("sala") ? <LocationItem place="sala" /> : null}
        </div>
        {videoAction}
      </footer>
    </article>
  );
}
