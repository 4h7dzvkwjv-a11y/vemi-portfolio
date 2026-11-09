"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";

type VideoResponse = {
  available: true;
  exerciseKey: string;
  exerciseName: string;
  url: string;
  posterUrl: string | null;
  mimeType: string;
  durationSeconds: number | null;
};

type ActiveVideoMedia = VideoResponse & {
  requestId: number;
};

type ExerciseVideoProps = {
  exerciseKey: string;
  exerciseName: string;
  className?: string;
  label?: string;
};

type MissingReason = "unavailable" | "square-video-required";

const MOBILE_DEMO_MEDIA_QUERY = "(max-width: 600px)";

export function ExerciseVideo({ exerciseKey, exerciseName, className = "", label }: ExerciseVideoProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading-url" | "ready" | "missing">("idle");
  const [media, setMedia] = useState<ActiveVideoMedia | null>(null);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [playRequested, setPlayRequested] = useState(false);
  const [firstFrameVisible, setFirstFrameVisible] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [closing, setClosing] = useState(false);
  const [mobileCustomControls, setMobileCustomControls] = useState(false);
  const [missingReason, setMissingReason] = useState<MissingReason>("unavailable");
  const videoRef = useRef<HTMLVideoElement>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const playbackAttemptIdRef = useRef(0);
  const playRequestedRef = useRef(false);
  const frameCallbackIdRef = useRef<number | null>(null);
  const fallbackFrameRafRef = useRef<number | null>(null);
  const decodedFrameReadyRef = useRef(false);
  const playbackFlowingRef = useRef(false);
  const firstFrameVisibleRef = useRef(false);
  const playStartedAtRef = useRef<number | null>(null);
  const posterStartedAtRef = useRef<number | null>(null);
  const modalPresentationReady = status === "missing" || (
    status === "ready"
    && media !== null
    && media.requestId === requestIdRef.current
    && (!media.posterUrl || posterLoaded || posterFailed)
  );

  function reportTiming(metric: "api-response" | "poster" | "first-frame", startedAt: number) {
    if (process.env.NODE_ENV === "production") return;
    const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
    console.info("VEMI video timing", { exerciseKey, metric, durationMs });
  }

  function traceVideoEvent(event: "modal-open" | "api-start" | "api-response" | "poster-visible" | "poster-error" | "tap-play" | "loadstart" | "loadedmetadata" | "loadeddata" | "canplay" | "first-frame" | "play" | "playing" | "waiting" | "stalled" | "error") {
    if (process.env.NODE_ENV === "production") return;
    console.info("VEMI video lifecycle", { exerciseKey, event, at: Math.round(performance.now() * 10) / 10 });
  }

  function cancelFirstFrameDetection(video: HTMLVideoElement | null = videoRef.current) {
    if (video && frameCallbackIdRef.current !== null && typeof video.cancelVideoFrameCallback === "function") {
      video.cancelVideoFrameCallback(frameCallbackIdRef.current);
    }
    frameCallbackIdRef.current = null;
    if (fallbackFrameRafRef.current !== null) cancelAnimationFrame(fallbackFrameRafRef.current);
    fallbackFrameRafRef.current = null;
  }

  function releaseVideo() {
    requestIdRef.current += 1;
    fetchControllerRef.current?.abort();
    fetchControllerRef.current = null;
    const video = videoRef.current;
    cancelFirstFrameDetection(video);
    flushSync(() => setClosing(true));
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.querySelector("source")?.removeAttribute("src");
      video.load();
    }
    playbackAttemptIdRef.current += 1;
    playRequestedRef.current = false;
    decodedFrameReadyRef.current = false;
    playbackFlowingRef.current = false;
    firstFrameVisibleRef.current = false;
    playStartedAtRef.current = null;
    posterStartedAtRef.current = null;
    flushSync(() => setOpen(false));
    setMedia(null);
    setPosterLoaded(false);
    setPosterFailed(false);
    setPlayRequested(false);
    setFirstFrameVisible(false);
    setPlaybackError(false);
    setClosing(false);
    setMobileCustomControls(false);
    setMissingReason("unavailable");
    setStatus("idle");
  }

  async function openVideo() {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    flushSync(() => {
      setOpen(true);
      setMedia(null);
      setPosterLoaded(false);
      setPosterFailed(false);
      setPlayRequested(false);
      setFirstFrameVisible(false);
      setPlaybackError(false);
      setClosing(false);
      setMobileCustomControls(false);
      setMissingReason("unavailable");
      setStatus("loading-url");
    });
    playRequestedRef.current = false;
    decodedFrameReadyRef.current = false;
    playbackFlowingRef.current = false;
    firstFrameVisibleRef.current = false;
    playStartedAtRef.current = null;
    posterStartedAtRef.current = null;
    traceVideoEvent("modal-open");

    try {
      const apiStartedAt = performance.now();
      traceVideoEvent("api-start");
      const response = await fetch(`/api/exercises/${encodeURIComponent(exerciseKey)}/video?format=square`, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        const unavailable = await response.json().catch(() => null) as { reason?: string } | null;
        if (unavailable?.reason === "square-video-required") setMissingReason("square-video-required");
        throw new Error("video-unavailable");
      }
      const payload = await response.json() as VideoResponse;
      if (requestId !== requestIdRef.current) return;
      reportTiming("api-response", apiStartedAt);
      traceVideoEvent("api-response");
      posterStartedAtRef.current = payload.posterUrl ? performance.now() : null;
      setMedia({ ...payload, requestId });
      setStatus("ready");
    } catch {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setMedia(null);
      setStatus("missing");
    } finally {
      if (requestId === requestIdRef.current) fetchControllerRef.current = null;
    }
  }

  async function revealDecodedPoster(image: HTMLImageElement, mediaRequestId: number) {
    try {
      await image.decode();
    } catch {
      // onLoad already confirmed a usable image; decode can reject after a cached load.
    }
    if (mediaRequestId !== requestIdRef.current) return;
    setPosterLoaded(true);
    const startedAt = posterStartedAtRef.current;
    if (startedAt !== null) reportTiming("poster", startedAt);
    posterStartedAtRef.current = null;
    traceVideoEvent("poster-visible");
  }

  function revealFirstFrameWhenPlaybackFlows(attemptId: number, mediaRequestId: number) {
    if (attemptId !== playbackAttemptIdRef.current || mediaRequestId !== requestIdRef.current || !playRequestedRef.current) return;
    if (!decodedFrameReadyRef.current || !playbackFlowingRef.current || firstFrameVisibleRef.current) return;
    firstFrameVisibleRef.current = true;
    const startedAt = playStartedAtRef.current;
    if (startedAt !== null) reportTiming("first-frame", startedAt);
    traceVideoEvent("first-frame");
    setFirstFrameVisible(true);
    setPlaybackError(false);
  }

  function markFirstFrameVisible(attemptId: number, mediaRequestId: number) {
    if (attemptId !== playbackAttemptIdRef.current || mediaRequestId !== requestIdRef.current || !playRequestedRef.current) return;
    frameCallbackIdRef.current = null;
    fallbackFrameRafRef.current = null;
    decodedFrameReadyRef.current = true;
    revealFirstFrameWhenPlaybackFlows(attemptId, mediaRequestId);
  }

  function armFirstFrameDetection(video: HTMLVideoElement, attemptId: number, mediaRequestId: number) {
    cancelFirstFrameDetection(video);
    if (typeof video.requestVideoFrameCallback === "function") {
      frameCallbackIdRef.current = video.requestVideoFrameCallback(() => markFirstFrameVisible(attemptId, mediaRequestId));
    } else if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      fallbackFrameRafRef.current = requestAnimationFrame(() => markFirstFrameVisible(attemptId, mediaRequestId));
    }
  }

  function scheduleFallbackFirstFrame(video: HTMLVideoElement, mediaRequestId: number) {
    if (typeof video.requestVideoFrameCallback === "function" || !playRequestedRef.current) return;
    const attemptId = playbackAttemptIdRef.current;
    if (fallbackFrameRafRef.current !== null) cancelAnimationFrame(fallbackFrameRafRef.current);
    fallbackFrameRafRef.current = requestAnimationFrame(() => markFirstFrameVisible(attemptId, mediaRequestId));
  }

  function failPlayback(mediaRequestId: number) {
    if (mediaRequestId !== requestIdRef.current) return;
    traceVideoEvent("error");
    playbackAttemptIdRef.current += 1;
    playRequestedRef.current = false;
    decodedFrameReadyRef.current = false;
    playbackFlowingRef.current = false;
    firstFrameVisibleRef.current = false;
    cancelFirstFrameDetection();
    setPlayRequested(false);
    setFirstFrameVisible(false);
    setPlaybackError(true);
  }

  async function requestPlayback() {
    const video = videoRef.current;
    if (!video || !media || media.requestId !== requestIdRef.current) return;
    const attemptId = playbackAttemptIdRef.current + 1;
    playbackAttemptIdRef.current = attemptId;
    playRequestedRef.current = true;
    decodedFrameReadyRef.current = false;
    playbackFlowingRef.current = false;
    firstFrameVisibleRef.current = false;
    playStartedAtRef.current = performance.now();
    setMobileCustomControls(usesMobileCustomControls());
    setPlayRequested(true);
    setFirstFrameVisible(false);
    setPlaybackError(false);
    traceVideoEvent("tap-play");
    if (video.error) video.load();
    armFirstFrameDetection(video, attemptId, media.requestId);
    try {
      await video.play();
    } catch {
      failPlayback(media.requestId);
    }
  }

  function usesMobileCustomControls() {
    return window.matchMedia(MOBILE_DEMO_MEDIA_QUERY).matches;
  }

  async function toggleMobilePlayback() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      if (video.ended) video.currentTime = 0;
      try {
        await video.play();
      } catch {
        return;
      }
      return;
    }

    video.pause();
  }

  useEffect(() => {
    const query = window.matchMedia(MOBILE_DEMO_MEDIA_QUERY);
    const updateControlMode = () => setMobileCustomControls(query.matches);
    updateControlMode();
    query.addEventListener("change", updateControlMode);
    return () => query.removeEventListener("change", updateControlMode);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const computedPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") releaseVideo();
    }
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => () => {
    const video = videoRef.current;
    cancelFirstFrameDetection(video);
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.querySelector("source")?.removeAttribute("src");
      video.load();
    }
  }, []);

  return (
    <>
      <button
        type="button"
        className={`exercise-video-trigger ${className}`.trim()}
        onClick={(event) => {
          event.stopPropagation();
          void openVideo();
        }}
        aria-label={`Vezi demonstrația pentru ${exerciseName}`}
      >
        <span aria-hidden="true">▶</span>{label && <b>{label}</b>}
      </button>

      {open && createPortal(
        <div
          className={`exercise-video-backdrop${modalPresentationReady ? "" : " is-preparing"}`}
          aria-hidden={!modalPresentationReady}
          onMouseDown={(event) => event.target === event.currentTarget && releaseVideo()}
        >
          <section className="exercise-video-dialog square-only" role="dialog" aria-modal="true" aria-labelledby={`video-title-${exerciseKey}`}>
            <header>
              <div><h2 id={`video-title-${exerciseKey}`}>{exerciseName}</h2></div>
              <button type="button" onClick={releaseVideo} aria-label="Închide demonstrația">×</button>
            </header>

            <div className={`exercise-video-stage${closing ? " is-closing" : ""}`} aria-busy={status === "loading-url" || (playRequested && !firstFrameVisible && !playbackError)}>
              {status === "missing" && (
                <div className="exercise-video-state">
                  <strong>{missingReason === "square-video-required" ? "Videoclipul pătrat este în curs de pregătire." : "Videoclipul nu este încă disponibil."}</strong>
                  <span>{missingReason === "square-video-required" ? "Demonstrația existentă nu respectă noul format 1:1 și nu este afișată. Va reveni după înlocuirea cu varianta pătrată." : "Poți continua antrenamentul folosind indicațiile scrise."}</span>
                </div>
              )}
              {status === "ready" && media && (
                <>
                  <div className="exercise-video-fallback" data-layer="fallback" aria-hidden="true" />
                  {media.posterUrl && !posterFailed && (
                    /* eslint-disable-next-line @next/next/no-img-element -- signed URL, single lifecycle-owned poster */
                    <img
                      className={`exercise-video-poster-image ${posterLoaded ? "is-loaded" : "is-loading"}`}
                      data-layer="poster"
                      src={media.posterUrl}
                      alt=""
                      aria-hidden="true"
                      onLoad={(event) => void revealDecodedPoster(event.currentTarget, media.requestId)}
                      onError={() => {
                        if (media.requestId !== requestIdRef.current) return;
                        posterStartedAtRef.current = null;
                        setPosterLoaded(false);
                        setPosterFailed(true);
                        traceVideoEvent("poster-error");
                      }}
                    />
                  )}
                  <video
                    ref={videoRef}
                    className={firstFrameVisible && !closing ? "is-playing" : "is-waiting"}
                    data-layer="video"
                    controls={firstFrameVisible && !mobileCustomControls}
                    preload="metadata"
                    src={media.url}
                    playsInline
                    loop
                    muted
                    aria-label={`Demonstrație video: ${exerciseName}`}
                    onLoadStart={() => traceVideoEvent("loadstart")}
                    onLoadedMetadata={() => traceVideoEvent("loadedmetadata")}
                    onLoadedData={(event) => {
                      traceVideoEvent("loadeddata");
                      scheduleFallbackFirstFrame(event.currentTarget, media.requestId);
                    }}
                    onCanPlay={() => traceVideoEvent("canplay")}
                    onPlay={() => {
                      traceVideoEvent("play");
                      setMobileCustomControls(usesMobileCustomControls());
                    }}
                    onPlaying={() => {
                      traceVideoEvent("playing");
                      playbackFlowingRef.current = true;
                      revealFirstFrameWhenPlaybackFlows(playbackAttemptIdRef.current, media.requestId);
                    }}
                    onWaiting={() => {
                      traceVideoEvent("waiting");
                      if (!firstFrameVisibleRef.current) playbackFlowingRef.current = false;
                    }}
                    onStalled={() => {
                      traceVideoEvent("stalled");
                      if (!firstFrameVisibleRef.current) playbackFlowingRef.current = false;
                    }}
                    onError={() => failPlayback(media.requestId)}
                  >
                    Browserul tău nu poate reda acest videoclip.
                  </video>
                  {!playRequested && !firstFrameVisible && !closing && (
                    <button
                      type="button"
                      className={`exercise-video-play${playbackError ? " is-error" : ""}`}
                      data-layer="control"
                      aria-label={playbackError ? `Reîncearcă demonstrația pentru ${exerciseName}` : `Pornește demonstrația pentru ${exerciseName}`}
                      onClick={() => void requestPlayback()}
                    >
                      <i className={playbackError ? "retry-icon" : "play-icon"} aria-hidden="true">
                        {playbackError ? "↻" : "▶"}
                      </i>
                    </button>
                  )}
                  {firstFrameVisible && mobileCustomControls && !closing && (
                    <button
                      type="button"
                      className="exercise-video-mobile-toggle"
                      aria-label={`Redă sau pune pe pauză demonstrația pentru ${exerciseName}`}
                      onClick={() => void toggleMobilePlayback()}
                    />
                  )}
                </>
              )}
            </div>

            <p>Videoclipul este încărcat doar când îl deschizi și este eliberat când închizi fereastra.</p>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
