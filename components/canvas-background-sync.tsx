"use client";

import { useLayoutEffect } from "react";

const MOBILE_QUERY = "(max-width: 767px)";
const CANVAS_VARIABLE = "--vemi-canvas-background";
const SURFACE_SELECTOR = "section, footer, main, aside, [role='dialog']";

function isVisibleColor(color: string) {
  if (!color || color === "transparent") return false;

  const alphaMatch = color.match(/rgba?\([^)]*[,/]\s*([\d.]+)\s*\)$/i);
  return !alphaMatch || Number(alphaMatch[1]) > 0.98;
}

function readSurfaceColor(element: Element | null) {
  let surface = element?.closest(SURFACE_SELECTOR) ?? null;

  while (surface) {
    const color = window.getComputedStyle(surface).backgroundColor;
    if (isVisibleColor(color)) return color;
    surface = surface.parentElement?.closest(SURFACE_SELECTOR) ?? null;
  }

  return null;
}

function getVisibleSurfaceColor() {
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const y = Math.max(
    0,
    Math.min(window.innerHeight - 1, viewportTop + viewportHeight * 0.68),
  );
  const x = Math.max(0, Math.round(document.documentElement.clientWidth / 2));
  const elements = document.elementsFromPoint(x, y);

  for (const element of elements) {
    if (element === document.documentElement || element === document.body) continue;
    const color = readSurfaceColor(element);
    if (color && isVisibleColor(color)) return color;
  }

  return window.getComputedStyle(document.body).backgroundColor;
}

export function CanvasBackgroundSync() {
  useLayoutEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const root = document.documentElement;
    let frame = 0;
    let currentColor = "";

    const sync = () => {
      frame = 0;

      if (!media.matches) {
        currentColor = "";
        root.style.removeProperty(CANVAS_VARIABLE);
        return;
      }

      const color = getVisibleSurfaceColor();
      if (!isVisibleColor(color) || color === currentColor) return;

      currentColor = color;
      root.style.setProperty(CANVAS_VARIABLE, color);
    };

    const scheduleSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });

    scheduleSync();
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync, { passive: true });
    window.addEventListener("orientationchange", scheduleSync, { passive: true });
    window.addEventListener("pageshow", scheduleSync);
    window.addEventListener("popstate", scheduleSync);
    media.addEventListener("change", scheduleSync);
    window.visualViewport?.addEventListener("resize", scheduleSync, { passive: true });
    window.visualViewport?.addEventListener("scroll", scheduleSync, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("orientationchange", scheduleSync);
      window.removeEventListener("pageshow", scheduleSync);
      window.removeEventListener("popstate", scheduleSync);
      media.removeEventListener("change", scheduleSync);
      window.visualViewport?.removeEventListener("resize", scheduleSync);
      window.visualViewport?.removeEventListener("scroll", scheduleSync);
      root.style.removeProperty(CANVAS_VARIABLE);
    };
  }, []);

  return null;
}
