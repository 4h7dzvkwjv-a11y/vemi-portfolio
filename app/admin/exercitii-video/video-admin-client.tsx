"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sha256Hex } from "../../../lib/video/digest";
import { validateExerciseVideoMp4 } from "../../../lib/video/mp4-validator";
import {
  describeAcceptedExerciseVideoResolutions,
  EXERCISE_POSTER_CONTENT_TYPE,
  isAcceptedExerciseVideoDimensions,
  MAX_EXERCISE_VIDEO_BYTES,
  MAX_EXERCISE_VIDEO_MEGABYTES,
} from "../../../lib/video/upload-policy";

type VideoStatus = "available" | "missing" | "incompatible";
type UploadStage = "idle" | "preparing" | "uploading" | "verifying" | "poster" | "associating" | "success" | "error";

type ExerciseAdminItem = {
  exerciseKey: string;
  name: string;
  group: string;
  status: VideoStatus;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  updatedAt: string | null;
  hasPoster: boolean;
};

type ExerciseResponse = {
  exerciseKey: string;
  name: string;
  status: "available";
  width: number;
  height: number;
  durationSeconds: number;
  fileSizeBytes: number;
  updatedAt: string;
};

type Preview = {
  file: File;
  url: string;
  width: number;
  height: number;
  durationSeconds: number;
  sha256: string;
};

type UploadPreparation = {
  method: "PUT";
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
  mutationId: string;
  uploadToken: string;
};

type PosterUploadPreparation = Omit<UploadPreparation, "uploadToken"> & { posterToken: string };

type GeneratedPoster = {
  blob: Blob;
  width: number;
  height: number;
  sha256: string;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  stage?: "prepare" | "cors-preflight" | "r2-put" | "verify" | "poster" | "associate" | "abort";
  code?: string;
  alreadyAssociated?: boolean;
  alreadyGenerated?: boolean;
  generated?: boolean;
  exercise?: ExerciseResponse;
  upload?: UploadPreparation;
  posterUpload?: PosterUploadPreparation;
  verification?: {
    mutationId: string;
    verificationToken: string;
  };
};

class UploadFlowError extends Error {
  constructor(
    message: string,
    readonly stage: NonNullable<ApiResponse["stage"]>,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "UploadFlowError";
  }
}

function requestStage(path: string): NonNullable<ApiResponse["stage"]> {
  if (path.includes("/poster/")) return "poster";
  if (path.endsWith("/verify")) return "verify";
  if (path.endsWith("/associate")) return "associate";
  if (path.endsWith("/abort")) return "abort";
  return "prepare";
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: "loadedmetadata" | "loadeddata" | "seeked") {
  return new Promise<void>((resolve, reject) => {
    const onSuccess = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("Cadrul posterului nu a putut fi extras.")); };
    const cleanup = () => {
      video.removeEventListener(eventName, onSuccess);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(eventName, onSuccess, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function generateExercisePoster(source: Blob | string): Promise<GeneratedPoster> {
  const sourceUrl = typeof source === "string" ? source : URL.createObjectURL(source);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = sourceUrl;

  try {
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) await waitForVideoEvent(video, "loadedmetadata");
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) await waitForVideoEvent(video, "loadeddata");
    const outputSize = Math.min(720, Math.max(160, Math.min(video.videoWidth, video.videoHeight)));
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Browserul nu poate genera imaginea de preview.");

    const lastSafeTime = Math.max(0, video.duration - 0.05);
    const candidates = [Math.min(0.18, lastSafeTime), 0.45, 0.9, 1.5]
      .map((value) => Math.min(value, lastSafeTime))
      .filter((value, index, values) => values.indexOf(value) === index);
    let bestScore = -1;
    let bestPixels: ImageData | null = null;

    for (const time of candidates) {
      if (Math.abs(video.currentTime - time) > 0.01) {
        const seeked = waitForVideoEvent(video, "seeked");
        video.currentTime = time;
        await seeked;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, outputSize, outputSize);
      const scale = Math.min(outputSize / video.videoWidth, outputSize / video.videoHeight);
      const drawWidth = video.videoWidth * scale;
      const drawHeight = video.videoHeight * scale;
      context.drawImage(video, (outputSize - drawWidth) / 2, (outputSize - drawHeight) / 2, drawWidth, drawHeight);
      const pixels = context.getImageData(0, 0, outputSize, outputSize);
      let luminanceTotal = 0;
      let visiblePixels = 0;
      const step = Math.max(4, Math.floor(outputSize / 80)) * 4;
      for (let index = 0; index < pixels.data.length; index += step) {
        const luminance = pixels.data[index] * 0.2126 + pixels.data[index + 1] * 0.7152 + pixels.data[index + 2] * 0.0722;
        luminanceTotal += luminance;
        if (luminance > 18) visiblePixels += 1;
      }
      const samples = Math.ceil(pixels.data.length / step);
      const average = luminanceTotal / samples;
      const visibleRatio = visiblePixels / samples;
      const score = average + visibleRatio * 120;
      if (score > bestScore) {
        bestScore = score;
        bestPixels = pixels;
      }
      if (average >= 20 && visibleRatio >= 0.2) break;
    }
    if (bestPixels) context.putImageData(bestPixels, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("Posterul nu a putut fi salvat.")),
      EXERCISE_POSTER_CONTENT_TYPE,
    ));
    return {
      blob,
      width: outputSize,
      height: outputSize,
      sha256: await sha256Hex(await blob.arrayBuffer()),
    };
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    if (typeof source !== "string") URL.revokeObjectURL(sourceUrl);
  }
}

const statusLabels: Record<VideoStatus, string> = {
  available: "Disponibil",
  missing: "Lipsă",
  incompatible: "Incompatibil",
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

async function inspectVideoFile(file: File) {
  if (!file.name.toLocaleLowerCase("ro").endsWith(".mp4") || (file.type && file.type !== "video/mp4")) {
    throw new Error("Este acceptat numai formatul MP4.");
  }
  if (file.size <= 0) throw new Error("Fișierul video este gol.");
  if (file.size > MAX_EXERCISE_VIDEO_BYTES) {
    throw new Error(`Fișierul depășește limita de ${MAX_EXERCISE_VIDEO_MEGABYTES} MB.`);
  }

  const bytes = await file.arrayBuffer();
  const localValidation = validateExerciseVideoMp4(bytes);
  if (!localValidation.valid) throw new Error(localValidation.message);
  const digest = await sha256Hex(bytes);

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  return new Promise<Preview>((resolve, reject) => {
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      const renderedWidth = video.videoWidth;
      const renderedHeight = video.videoHeight;
      const renderedDuration = video.duration;
      if (!isAcceptedExerciseVideoDimensions(renderedWidth, renderedHeight)) {
        URL.revokeObjectURL(url);
        reject(new Error(`Videoclipul trebuie să fie pătrat, în format 1:1. Fișierul selectat are rezoluția ${renderedWidth} × ${renderedHeight}.`));
        return;
      }
      if (!Number.isFinite(renderedDuration) || renderedDuration <= 0) {
        URL.revokeObjectURL(url);
        reject(new Error("Durata videoclipului nu a putut fi citită."));
        return;
      }
      resolve({
        file,
        url,
        width: localValidation.metadata.width,
        height: localValidation.metadata.height,
        durationSeconds: localValidation.metadata.durationSeconds,
        sha256: digest,
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Fișierul nu poate fi redat sau este corupt."));
    };
    video.src = url;
  });
}

async function postJson(path: string, body: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
    cache: "no-store",
    signal,
  });
  const payload = await response.json().catch(() => null) as ApiResponse | null;
  if (!response.ok || !payload?.success) {
    throw new UploadFlowError(
      payload?.message ?? "Operațiunea nu a putut fi confirmată.",
      payload?.stage ?? requestStage(path),
      payload?.code ?? "UPLOAD_REQUEST_FAILED",
      response.status,
    );
  }
  return payload;
}

function putDirectlyToR2(
  upload: Pick<UploadPreparation, "method" | "url" | "headers">,
  file: Blob,
  onProgress: (percentage: number) => void,
  onRequest: (request: XMLHttpRequest | null) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    onRequest(request);
    request.open(upload.method, upload.url, true);
    request.withCredentials = false;
    request.timeout = 12 * 60 * 1000;
    for (const [name, value] of Object.entries(upload.headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    request.onload = () => {
      onRequest(null);
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        const signatureRejected = request.status === 403 && /SignatureDoesNotMatch/i.test(request.responseText);
        reject(new UploadFlowError(
          signatureRejected
            ? "Semnătura temporară R2 a fost respinsă. Fișierul existent a fost păstrat."
            : `R2 a respins cererea PUT (${request.status || "fără răspuns"}). Fișierul existent a fost păstrat.`,
          "r2-put",
          signatureRejected ? "R2_SIGNATURE_REJECTED" : "R2_PUT_REJECTED",
          request.status,
        ));
      }
    };
    request.onerror = () => {
      onRequest(null);
      reject(new UploadFlowError(
        "Cererea PUT directă către R2 nu a primit răspuns. Preflightul a fost verificat de server; verifică conexiunea și reîncearcă.",
        "r2-put",
        "R2_PUT_NETWORK_ERROR",
        0,
      ));
    };
    request.ontimeout = () => {
      onRequest(null);
      reject(new UploadFlowError(
        "Cererea PUT directă către R2 a expirat. Fișierul existent a fost păstrat.",
        "r2-put",
        "R2_PUT_TIMEOUT",
        0,
      ));
    };
    request.onabort = () => {
      onRequest(null);
      reject(new UploadFlowError(
        "Încărcarea a fost întreruptă. Fișierul existent a fost păstrat.",
        "r2-put",
        "R2_UPLOAD_ABORTED",
        0,
      ));
    };
    request.send(file);
  });
}

export function AdminExerciseVideos({ initialExercises }: { initialExercises: ExerciseAdminItem[] }) {
  const [exercises, setExercises] = useState(initialExercises);
  const [selectedKey, setSelectedKey] = useState(initialExercises[0]?.exerciseKey ?? "");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | VideoStatus>("all");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const mutationIdRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const activeXhrRef = useRef<XMLHttpRequest | null>(null);
  const activeFetchRef = useRef<AbortController | null>(null);
  const selected = exercises.find((exercise) => exercise.exerciseKey === selectedKey) ?? exercises[0];
  const isBusy = uploadStage === "preparing"
    || uploadStage === "uploading"
    || uploadStage === "verifying"
    || uploadStage === "poster"
    || uploadStage === "associating"
    || backfillRunning;

  const missingPosterCount = exercises.filter((exercise) => exercise.status === "available" && !exercise.hasPoster).length;

  const filtered = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("ro");
    return exercises.filter((exercise) => {
      const matchesSearch = !normalized
        || exercise.name.toLocaleLowerCase("ro").includes(normalized)
        || exercise.group.toLocaleLowerCase("ro").includes(normalized)
        || exercise.exerciseKey.includes(normalized);
      return matchesSearch && (statusFilter === "all" || exercise.status === statusFilter);
    });
  }, [exercises, search, statusFilter]);

  const counts = useMemo(() => ({
    available: exercises.filter((exercise) => exercise.status === "available").length,
    missing: exercises.filter((exercise) => exercise.status === "missing").length,
    incompatible: exercises.filter((exercise) => exercise.status === "incompatible").length,
  }), [exercises]);

  useEffect(() => () => {
    activeFetchRef.current?.abort();
    activeXhrRef.current?.abort();
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  function applyConfirmedExercise(confirmed: ExerciseResponse) {
    setExercises((current) => current.map((exercise) => exercise.exerciseKey === confirmed.exerciseKey
      ? { ...exercise, ...confirmed, hasPoster: true }
      : exercise));
  }

  async function backfillMissingPosters() {
    if (backfillRunning || isBusy) return;
    const candidates = exercises.filter((exercise) => exercise.status === "available" && !exercise.hasPoster);
    if (candidates.length === 0) {
      setBackfillMessage("Toate videoclipurile compatibile au deja poster.");
      return;
    }
    setBackfillRunning(true);
    let generated = 0;
    let failed = 0;
    for (let index = 0; index < candidates.length; index += 1) {
      const exercise = candidates[index];
      let posterToken: string | null = null;
      try {
        setBackfillMessage(`Se generează posterul ${index + 1} din ${candidates.length}: ${exercise.name}…`);
        const poster = await generateExercisePoster(`/api/admin/exercise-videos/posters/source/${encodeURIComponent(exercise.exerciseKey)}`);
        const mutationId = crypto.randomUUID();
        const preparation = await postJson("/api/admin/exercise-videos/posters/backfill/prepare", {
          exerciseKey: exercise.exerciseKey,
          mutationId,
          poster: {
            type: EXERCISE_POSTER_CONTENT_TYPE,
            size: poster.blob.size,
            sha256: poster.sha256,
            width: poster.width,
            height: poster.height,
          },
        });
        if (preparation.alreadyGenerated) {
          setExercises((current) => current.map((item) => item.exerciseKey === exercise.exerciseKey ? { ...item, hasPoster: true } : item));
          continue;
        }
        if (!preparation.posterUpload) throw new Error("Autorizația posterului lipsește.");
        posterToken = preparation.posterUpload.posterToken;
        await putDirectlyToR2(preparation.posterUpload, poster.blob, () => undefined, (request) => {
          activeXhrRef.current = request;
        });
        const association = await postJson("/api/admin/exercise-videos/posters/backfill/associate", {
          exerciseKey: exercise.exerciseKey,
          mutationId,
          posterToken,
        });
        if (!association.generated && !association.alreadyGenerated) throw new Error("Asocierea posterului nu a fost confirmată.");
        generated += association.generated ? 1 : 0;
        setExercises((current) => current.map((item) => item.exerciseKey === exercise.exerciseKey ? { ...item, hasPoster: true } : item));
      } catch {
        failed += 1;
        if (posterToken) await cleanupInterruptedUpload(null, null, posterToken);
      }
    }
    activeXhrRef.current = null;
    setBackfillRunning(false);
    setBackfillMessage(`Backfill finalizat: ${generated} postere generate, ${failed} eșuate.`);
  }

  function clearPreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setValidationMessage(null);
    setUploadMessage(null);
    setUploadStage("idle");
    setUploadProgress(0);
    mutationIdRef.current = null;
  }

  async function chooseFile(file: File | undefined) {
    clearPreview();
    if (!file) return;
    try {
      const inspected = await inspectVideoFile(file);
      setPreview(inspected);
      mutationIdRef.current = crypto.randomUUID();
      setValidationMessage(`Validare locală reușită: ${inspected.width} × ${inspected.height}, MP4 H.264. Fișierul va fi verificat din nou pe server după încărcarea directă în R2.`);
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : "Fișierul nu a putut fi verificat.");
      setUploadStage("error");
    }
  }

  async function cleanupInterruptedUpload(uploadToken: string | null, verificationToken: string | null, posterToken: string | null) {
    if (!uploadToken && !verificationToken && !posterToken) return;
    try {
      await postJson("/api/admin/exercise-videos/upload/abort", { uploadToken, verificationToken, posterToken });
    } catch {
      // The next preparation request also removes stale staging objects.
    }
  }

  function cancelUpload() {
    activeFetchRef.current?.abort();
    activeXhrRef.current?.abort();
  }

  async function upload() {
    if (!selected || !preview || inFlightRef.current) return;
    inFlightRef.current = true;
    setUploadProgress(0);
    let uploadToken: string | null = null;
    let verificationToken: string | null = null;
    let posterToken: string | null = null;

    try {
      const mutationId = mutationIdRef.current ?? crypto.randomUUID();
      mutationIdRef.current = mutationId;
      const controller = new AbortController();
      activeFetchRef.current = controller;
      setUploadStage("preparing");
      setUploadMessage("Se pregătește o autorizație temporară, limitată la acest exercițiu și la un singur obiect R2…");
      const preparation = await postJson("/api/admin/exercise-videos/upload/prepare", {
        exerciseKey: selected.exerciseKey,
        mutationId,
        file: {
          name: preview.file.name,
          type: "video/mp4",
          size: preview.file.size,
          sha256: preview.sha256,
          width: preview.width,
          height: preview.height,
          durationSeconds: preview.durationSeconds,
        },
      }, controller.signal);
      if (preparation.alreadyAssociated && preparation.exercise) {
        applyConfirmedExercise(preparation.exercise);
        setUploadStage("success");
        setUploadMessage("Videoclipul era deja verificat și asociat corect.");
        return;
      }
      if (!preparation.upload) throw new Error("Autorizația temporară R2 nu a fost primită.");
      uploadToken = preparation.upload.uploadToken;

      setUploadStage("uploading");
      setUploadMessage("Videoclipul se încarcă direct în R2 — 0%.");
      await putDirectlyToR2(preparation.upload, preview.file, (percentage) => {
        setUploadProgress(percentage);
        setUploadMessage(`Videoclipul se încarcă direct în R2 — ${percentage}%.`);
      }, (request) => {
        activeXhrRef.current = request;
      });

      const verificationController = new AbortController();
      activeFetchRef.current = verificationController;
      setUploadStage("verifying");
      setUploadMessage("Serverul recitește obiectul din R2 și verifică MP4, H.264, rezoluția 1:1, dimensiunea și amprenta fișierului…");
      const verification = await postJson("/api/admin/exercise-videos/upload/verify", {
        exerciseKey: selected.exerciseKey,
        mutationId,
        uploadToken,
      }, verificationController.signal);
      if (!verification.verification) throw new Error("Verificarea server-side nu a putut fi confirmată.");
      verificationToken = verification.verification.verificationToken;

      setUploadStage("poster");
      setUploadMessage("Se extrage primul cadru clar și se pregătește posterul pătrat…");
      const poster = await generateExercisePoster(preview.file);
      const posterController = new AbortController();
      activeFetchRef.current = posterController;
      const posterPreparation = await postJson("/api/admin/exercise-videos/upload/poster/prepare", {
        exerciseKey: selected.exerciseKey,
        mutationId,
        verificationToken,
        poster: {
          type: EXERCISE_POSTER_CONTENT_TYPE,
          size: poster.blob.size,
          sha256: poster.sha256,
          width: poster.width,
          height: poster.height,
        },
      }, posterController.signal);
      if (!posterPreparation.posterUpload) throw new Error("Autorizația temporară pentru poster nu a fost primită.");
      posterToken = posterPreparation.posterUpload.posterToken;
      setUploadMessage("Posterul pătrat se încarcă direct și securizat în R2…");
      await putDirectlyToR2(posterPreparation.posterUpload, poster.blob, () => undefined, (request) => {
        activeXhrRef.current = request;
      });

      const associationController = new AbortController();
      activeFetchRef.current = associationController;
      setUploadStage("associating");
      setUploadMessage("Videoclipul verificat este asociat cu exercițiul, apoi asocierea este recitită din Supabase…");
      const association = await postJson("/api/admin/exercise-videos/upload/associate", {
        exerciseKey: selected.exerciseKey,
        mutationId,
        posterToken,
      }, associationController.signal);
      if (!association.exercise) throw new Error("Asocierea finală nu a putut fi confirmată.");

      applyConfirmedExercise(association.exercise);
      setUploadStage("success");
      setUploadMessage("Videoclipul a fost verificat, asociat și confirmat. Este acum disponibil pentru exercițiul selectat.");
    } catch (error) {
      await cleanupInterruptedUpload(uploadToken, verificationToken, posterToken);
      setUploadStage("error");
      setUploadMessage(error instanceof Error && error.name === "AbortError"
        ? "Încărcarea a fost întreruptă. Videoclipul existent a fost păstrat."
        : error instanceof Error ? error.message : "Încărcarea nu a putut fi confirmată.");
    } finally {
      activeFetchRef.current = null;
      activeXhrRef.current = null;
      inFlightRef.current = false;
    }
  }

  return (
    <section className="admin-video-workspace">
      <aside className="admin-video-catalog" aria-label="Catalogul exercițiilor">
        <div className="admin-video-summary">
          <span><b>{exercises.length}</b> active</span>
          <span><b>{counts.available}</b> disponibile</span>
          <span><b>{counts.missing}</b> lipsă</span>
          <span><b>{counts.incompatible}</b> incompatibile</span>
        </div>
        <div className="admin-video-backfill">
          <button type="button" disabled={isBusy || missingPosterCount === 0} onClick={() => void backfillMissingPosters()}>
            {backfillRunning ? "Se generează posterele…" : `Generează posterele lipsă (${missingPosterCount})`}
          </button>
          {backfillMessage && <small role="status">{backfillMessage}</small>}
        </div>
        <label className="admin-video-search">
          <span>Caută exercițiul</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex: Fluturări cu gantere" />
        </label>
        <label className="admin-video-filter">
          <span>Starea videoclipului</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">Toate stările</option>
            <option value="available">Disponibil</option>
            <option value="missing">Lipsă</option>
            <option value="incompatible">Incompatibil</option>
          </select>
        </label>
        <div className="admin-video-exercise-list">
          {filtered.map((exercise) => (
            <button
              type="button"
              key={exercise.exerciseKey}
              className={exercise.exerciseKey === selected?.exerciseKey ? "selected" : ""}
              onClick={() => {
                if (isBusy) return;
                clearPreview();
                setSelectedKey(exercise.exerciseKey);
              }}
            >
              <span><strong>{exercise.name}</strong><small>{exercise.group}</small></span>
              <i className={`admin-video-status ${exercise.status}`}>{statusLabels[exercise.status]}</i>
            </button>
          ))}
          {filtered.length === 0 && <p className="admin-video-no-results">Niciun exercițiu nu corespunde filtrului.</p>}
        </div>
      </aside>

      {selected && (
        <article className="admin-video-editor">
          <header>
            <div><p className="section-kicker">Exercițiul selectat</p><h2>{selected.name}</h2></div>
            <span className={`admin-video-status ${selected.status}`}>{statusLabels[selected.status]}</span>
          </header>

          <dl className="admin-video-current-meta">
            <div><dt>Grupă</dt><dd>{selected.group}</dd></div>
            <div><dt>Rezoluție actuală</dt><dd>{selected.width && selected.height ? `${selected.width} × ${selected.height}` : "—"}</dd></div>
            <div><dt>Dimensiune</dt><dd>{formatBytes(selected.fileSizeBytes)}</dd></div>
            <div><dt>Cheie canonică</dt><dd>{selected.exerciseKey}</dd></div>
          </dl>

          <div className="admin-video-upload-grid">
            <div className="admin-video-preview">
              {preview ? (
                <video src={preview.url} controls muted playsInline preload="metadata" aria-label={`Previzualizare pentru ${selected.name}`} />
              ) : (
                <div><strong>Previzualizarea pătrată apare aici</strong><span>Fișierul nu este încărcat automat.</span></div>
              )}
            </div>

            <div className="admin-video-controls">
              <div className="admin-video-rules">
                <strong>Format acceptat</strong>
                <p>MP4 H.264 · format pătrat 1:1 · maximum {MAX_EXERCISE_VIDEO_MEGABYTES} MB</p>
                <p>Rezoluții acceptate: {describeAcceptedExerciseVideoResolutions()}.</p>
              </div>

              <label className="admin-video-file-picker">
                <span>{preview ? "Alege alt videoclip" : "Selectează videoclipul"}</span>
                <input
                  type="file"
                  accept="video/mp4,.mp4"
                  disabled={isBusy}
                  onChange={(event) => void chooseFile(event.target.files?.[0])}
                />
              </label>

              {preview && (
                <dl className="admin-video-file-meta">
                  <div><dt>Fișier</dt><dd>{preview.file.name}</dd></div>
                  <div><dt>Rezoluție</dt><dd>{preview.width} × {preview.height}</dd></div>
                  <div><dt>Dimensiune</dt><dd>{formatBytes(preview.file.size)}</dd></div>
                  <div><dt>Durată</dt><dd>{Math.round(preview.durationSeconds * 10) / 10} sec</dd></div>
                </dl>
              )}

              {validationMessage && <p className={uploadStage === "error" ? "admin-video-message error" : "admin-video-message"}>{validationMessage}</p>}
              {uploadMessage && <p className={`admin-video-message ${uploadStage}`}>{uploadMessage}</p>}
              {uploadStage === "uploading" && (
                <div className="admin-video-upload-progress" role="progressbar" aria-label="Progres încărcare R2" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress}>
                  <span style={{ width: `${uploadProgress}%` }} />
                </div>
              )}

              <div className="admin-video-actions">
                <button
                  type="button"
                  className="admin-video-submit"
                  disabled={!preview || isBusy}
                  onClick={() => void upload()}
                >
                  {uploadStage === "error"
                    ? "Reîncearcă încărcarea"
                    : selected.status === "available" ? "Înlocuiește videoclipul" : "Încarcă videoclipul"}
                </button>
                {isBusy && (
                  <button type="button" className="admin-video-cancel" onClick={cancelUpload}>
                    Oprește încărcarea
                  </button>
                )}
              </div>
              {selected.status === "available" && <small className="admin-video-preserve-note">Videoclipul actual rămâne activ dacă noua încărcare eșuează sau este întreruptă.</small>}
            </div>
          </div>
        </article>
      )}
    </section>
  );
}
