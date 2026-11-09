import {
  describeAcceptedExerciseVideoResolutions,
  isAcceptedExerciseVideoDimensions,
  MAX_EXERCISE_VIDEO_BYTES,
} from "./upload-policy";

type Mp4Box = {
  type: string;
  start: number;
  contentStart: number;
  end: number;
};

export type ValidatedExerciseVideo = {
  width: number;
  height: number;
  durationSeconds: number;
  codec: "h264";
  mimeType: "video/mp4";
  fileSizeBytes: number;
};

export type ExerciseVideoValidation =
  | { valid: true; metadata: ValidatedExerciseVideo }
  | { valid: false; code: string; message: string };

function readAscii(view: DataView, offset: number, length: number) {
  if (offset < 0 || offset + length > view.byteLength) return "";
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += String.fromCharCode(view.getUint8(offset + index));
  }
  return result;
}

function readBoxes(view: DataView, from: number, to: number) {
  const boxes: Mp4Box[] = [];
  let cursor = from;

  while (cursor + 8 <= to) {
    const shortSize = view.getUint32(cursor);
    const type = readAscii(view, cursor + 4, 4);
    let size = shortSize;
    let headerSize = 8;

    if (shortSize === 1) {
      if (cursor + 16 > to) break;
      const extended = view.getBigUint64(cursor + 8);
      if (extended > BigInt(Number.MAX_SAFE_INTEGER)) break;
      size = Number(extended);
      headerSize = 16;
    } else if (shortSize === 0) {
      size = to - cursor;
    }

    if (!/^[\x20-\x7e]{4}$/.test(type) || size < headerSize || cursor + size > to) break;
    boxes.push({ type, start: cursor, contentStart: cursor + headerSize, end: cursor + size });
    cursor += size;
  }

  return boxes;
}

function child(boxes: Mp4Box[], type: string) {
  return boxes.find((box) => box.type === type);
}

function parseTrack(view: DataView, trak: Mp4Box) {
  const trakChildren = readBoxes(view, trak.contentStart, trak.end);
  const tkhd = child(trakChildren, "tkhd");
  const mdia = child(trakChildren, "mdia");
  if (!tkhd || !mdia) return null;

  const mdiaChildren = readBoxes(view, mdia.contentStart, mdia.end);
  const hdlr = child(mdiaChildren, "hdlr");
  const mdhd = child(mdiaChildren, "mdhd");
  const minf = child(mdiaChildren, "minf");
  if (!hdlr || !mdhd || !minf || readAscii(view, hdlr.contentStart + 8, 4) !== "vide") return null;

  const tkhdVersion = view.getUint8(tkhd.contentStart);
  const dimensionsOffset = tkhd.contentStart + (tkhdVersion === 1 ? 88 : 76);
  if (dimensionsOffset + 8 > tkhd.end) return null;
  const width = Math.round(view.getUint32(dimensionsOffset) / 65536);
  const height = Math.round(view.getUint32(dimensionsOffset + 4) / 65536);

  const mdhdVersion = view.getUint8(mdhd.contentStart);
  const timescaleOffset = mdhd.contentStart + (mdhdVersion === 1 ? 20 : 12);
  const durationOffset = mdhd.contentStart + (mdhdVersion === 1 ? 24 : 16);
  if (durationOffset + (mdhdVersion === 1 ? 8 : 4) > mdhd.end) return null;
  const timescale = view.getUint32(timescaleOffset);
  const durationUnits = mdhdVersion === 1
    ? Number(view.getBigUint64(durationOffset))
    : view.getUint32(durationOffset);
  const durationSeconds = timescale > 0 ? durationUnits / timescale : 0;

  const minfChildren = readBoxes(view, minf.contentStart, minf.end);
  const stbl = child(minfChildren, "stbl");
  if (!stbl) return null;
  const stblChildren = readBoxes(view, stbl.contentStart, stbl.end);
  const stsd = child(stblChildren, "stsd");
  if (!stsd || stsd.contentStart + 16 > stsd.end) return null;
  const sampleEntries = readBoxes(view, stsd.contentStart + 8, stsd.end);
  const codecBox = sampleEntries.find((entry) => entry.type === "avc1" || entry.type === "avc3");
  if (!codecBox) return null;

  return { width, height, durationSeconds, codec: "h264" as const };
}

export function validateExerciseVideoMp4(bytes: ArrayBuffer): ExerciseVideoValidation {
  if (bytes.byteLength <= 0) {
    return { valid: false, code: "empty-file", message: "Fișierul video este gol." };
  }
  if (bytes.byteLength > MAX_EXERCISE_VIDEO_BYTES) {
    return { valid: false, code: "file-too-large", message: "Fișierul depășește limita acceptată." };
  }

  const view = new DataView(bytes);
  const boxes = readBoxes(view, 0, view.byteLength);
  const ftyp = child(boxes, "ftyp");
  const moov = child(boxes, "moov");
  if (!ftyp || !moov || ftyp.contentStart + 4 > ftyp.end) {
    return { valid: false, code: "invalid-mp4", message: "Fișierul nu este un MP4 valid." };
  }

  const brand = readAscii(view, ftyp.contentStart, 4);
  if (!brand.trim()) {
    return { valid: false, code: "invalid-mp4", message: "Fișierul nu are o semnătură MP4 validă." };
  }

  const tracks = readBoxes(view, moov.contentStart, moov.end)
    .filter((box) => box.type === "trak")
    .map((track) => parseTrack(view, track))
    .filter((track): track is NonNullable<ReturnType<typeof parseTrack>> => Boolean(track));
  const videoTrack = tracks[0];

  if (!videoTrack) {
    return { valid: false, code: "h264-required", message: "Fișierul trebuie să conțină un flux video H.264 valid." };
  }
  if (!Number.isFinite(videoTrack.durationSeconds) || videoTrack.durationSeconds <= 0) {
    return { valid: false, code: "invalid-duration", message: "Durata videoclipului nu a putut fi verificată." };
  }
  if (!isAcceptedExerciseVideoDimensions(videoTrack.width, videoTrack.height)) {
    return {
      valid: false,
      code: "square-video-required",
      message: `Videoclipul trebuie să aibă una dintre rezoluțiile acceptate (${describeAcceptedExerciseVideoResolutions()}). Fișierul selectat are rezoluția ${videoTrack.width} × ${videoTrack.height}.`,
    };
  }

  return {
    valid: true,
    metadata: {
      width: videoTrack.width,
      height: videoTrack.height,
      durationSeconds: Math.round(videoTrack.durationSeconds * 1000) / 1000,
      codec: "h264",
      mimeType: "video/mp4",
      fileSizeBytes: bytes.byteLength,
    },
  };
}
