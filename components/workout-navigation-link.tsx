"use client";

import Link, { type LinkProps } from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { loadCloudProgress, onProgressSessionChange } from "../utils/progress/client";
import { readPendingAnonymousProgress } from "../utils/progress/anonymous";

export function useWorkoutNavigationHref(knownHasWorkout?: boolean | null) {
  const [resolvedHasWorkout, setResolvedHasWorkout] = useState<boolean | null>(null);

  useEffect(() => {
    if (knownHasWorkout !== undefined) {
      return;
    }

    let disposed = false;
    const resolveDestination = async () => {
      try {
        const cloud = await loadCloudProgress();
        if (disposed) return;
        setResolvedHasWorkout(cloud.authenticated
          ? cloud.workouts.length > 0
          : (readPendingAnonymousProgress()?.workouts.length ?? 0) > 0);
      } catch {
        if (!disposed) {
          setResolvedHasWorkout((readPendingAnonymousProgress()?.workouts.length ?? 0) > 0);
        }
      }
    };

    void resolveDestination();
    const unsubscribe = onProgressSessionChange(() => void resolveDestination());
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [knownHasWorkout]);

  const hasWorkout = knownHasWorkout !== undefined ? knownHasWorkout : resolvedHasWorkout;
  return hasWorkout === false ? "/antrenamentul-meu?creator=1" : "/antrenamentul-meu";
}

type WorkoutNavigationLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> &
  Omit<LinkProps, "href"> & {
    children: ReactNode;
    knownHasWorkout?: boolean | null;
  };

export function WorkoutNavigationLink({
  children,
  knownHasWorkout,
  ...props
}: WorkoutNavigationLinkProps) {
  const href = useWorkoutNavigationHref(knownHasWorkout);
  return <Link {...props} href={href}>{children}</Link>;
}
