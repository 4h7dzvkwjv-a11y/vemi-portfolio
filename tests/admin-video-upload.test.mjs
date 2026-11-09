import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function loadValidator() {
  const result = await build({
    entryPoints: [fileURLToPath(new URL("../lib/video/mp4-validator.ts", import.meta.url))],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  const source = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

function u32(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value);
  return bytes;
}

function ascii(value) {
  return Buffer.from(value, "ascii");
}

function box(type, ...content) {
  const body = Buffer.concat(content);
  return Buffer.concat([u32(body.length + 8), ascii(type), body]);
}

function syntheticMp4(width, height, codec = "avc1", targetBytes = null) {
  const ftyp = box("ftyp", ascii("isom"), u32(0), ascii("isom"), ascii("mp42"));
  const tkhdBody = Buffer.alloc(84);
  tkhdBody.writeUInt32BE(width * 65536, 76);
  tkhdBody.writeUInt32BE(height * 65536, 80);
  const tkhd = box("tkhd", tkhdBody);
  const mdhdBody = Buffer.alloc(20);
  mdhdBody.writeUInt32BE(1000, 12);
  mdhdBody.writeUInt32BE(6600, 16);
  const mdhd = box("mdhd", mdhdBody);
  const hdlrBody = Buffer.alloc(20);
  ascii("vide").copy(hdlrBody, 8);
  const hdlr = box("hdlr", hdlrBody);
  const sampleEntry = box(codec, Buffer.alloc(78));
  const stsd = box("stsd", Buffer.alloc(4), u32(1), sampleEntry);
  const moov = box("moov", box("trak", tkhd, box("mdia", mdhd, hdlr, box("minf", box("stbl", stsd)))));
  const base = Buffer.concat([ftyp, moov]);
  if (!targetBytes || targetBytes <= base.length + 8) return base;
  return Buffer.concat([base, box("mdat", Buffer.alloc(targetBytes - base.length - 8))]);
}

function validateBuffer(validator, buffer) {
  return validator(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

test("fiecare etapă verifică server-side sesiunea și rolul admin înainte de corpul JSON", async () => {
  const paths = [
    "app/api/admin/exercise-videos/upload/prepare/route.ts",
    "app/api/admin/exercise-videos/upload/verify/route.ts",
    "app/api/admin/exercise-videos/upload/associate/route.ts",
    "app/api/admin/exercise-videos/upload/abort/route.ts",
    "app/api/admin/exercise-videos/upload/poster/prepare/route.ts",
    "app/api/admin/exercise-videos/posters/backfill/prepare/route.ts",
    "app/api/admin/exercise-videos/posters/backfill/associate/route.ts",
  ];
  const [helper, page, client, ...routes] = await Promise.all([
    read("utils/admin/server.ts"),
    read("app/admin/exercitii-video/page.tsx"),
    read("app/admin/exercitii-video/video-admin-client.tsx"),
    ...paths.map(read),
  ]);

  assert.match(helper, /auth\.getClaims\(\)/);
  assert.match(helper, /from\("user_roles"\)/);
  assert.match(helper, /roleRow\?\.role !== "admin"/);
  for (const route of routes) {
    assert.match(route, /const admin = await getAdminContext\(\)/);
    assert.ok(route.indexOf("getAdminContext()") < route.indexOf("readSmallJson(request)"));
    assert.match(route, /isSameOriginAdminRequest\(request\)/);
  }
  assert.match(page, /if \(!admin\.authorized\) notFound\(\)/);
  assert.doesNotMatch([helper, page, client, ...routes].join("\n"), /service[_-]?role|SUPABASE_SERVICE/i);
});

test("pagina separă lipsa sesiunii de lipsa rolului fără să slăbească protecția admin", async () => {
  const [page, actions, accountPage, accountClient] = await Promise.all([
    read("app/admin/exercitii-video/page.tsx"),
    read("app/contul-meu/actions.ts"),
    read("app/contul-meu/page.tsx"),
    read("app/contul-meu/account-client.tsx"),
  ]);

  const sessionRedirect = page.indexOf("admin.status === 401");
  const forbiddenNotFound = page.indexOf("if (!admin.authorized) notFound()");
  assert.ok(sessionRedirect > -1 && forbiddenNotFound > sessionRedirect);
  assert.match(page, /redirect\("\/contul-meu\?next=%2Fadmin%2Fexercitii-video"\)/);
  assert.match(actions, /readText\(formData, "returnTo"\) === adminVideoPath/);
  assert.match(actions, /redirect\(returnTo\)/);
  assert.match(accountPage, /requestedNext === "\/admin\/exercitii-video"/);
  assert.match(accountClient, /type="hidden" name="returnTo" value=\{returnTo\}/);
  assert.doesNotMatch([page, actions, accountPage, accountClient].join("\n"), /deca\.andrei|@icloud|account_user_id/i);
});

test("Contul meu afișează intrarea video numai pentru rolul admin, iar ruta rămâne protejată separat", async () => {
  const [accountClient, accountPage, adminPage, styles] = await Promise.all([
    read("app/contul-meu/account-client.tsx"),
    read("app/contul-meu/page.tsx"),
    read("app/admin/exercitii-video/page.tsx"),
    read("app/globals.css"),
  ]);
  const conditionalStart = accountClient.indexOf('{account.role === "admin" ? (');
  const conditionalEnd = accountClient.indexOf(") : null}", conditionalStart);
  const adminEntry = accountClient.slice(conditionalStart, conditionalEnd);

  assert.ok(conditionalStart > -1 && conditionalEnd > conditionalStart);
  assert.match(adminEntry, /href="\/admin\/exercitii-video"/);
  assert.match(adminEntry, /Administrare video/);
  assert.match(accountPage, /roleRow\?\.role === "admin" \? "admin" : "user"/);
  assert.match(adminPage, /const admin = await getAdminContext\(\)/);
  assert.match(adminPage, /if \(!admin\.authorized\) notFound\(\)/);
  assert.match(styles, /\.account-admin-video-entry/);
});

test("panoul și toate validările video folosesc exclusiv exercițiile canonice active", async () => {
  const paths = [
    "app/api/admin/exercise-videos/upload/prepare/route.ts",
    "app/api/admin/exercise-videos/upload/verify/route.ts",
    "app/api/admin/exercise-videos/upload/poster/prepare/route.ts",
    "app/api/admin/exercise-videos/upload/associate/route.ts",
    "app/api/admin/exercise-videos/posters/backfill/prepare/route.ts",
    "app/api/admin/exercise-videos/posters/backfill/associate/route.ts",
    "app/api/admin/exercise-videos/posters/source/[exerciseKey]/route.ts",
  ];
  const [catalog, page, ...routes] = await Promise.all([
    read("lib/exercises/admin-catalog.ts"),
    read("app/admin/exercitii-video/page.tsx"),
    ...paths.map(read),
  ]);

  assert.match(catalog, /from\("exercises"\)/);
  assert.match(catalog, /\.eq\("is_active", true\)/);
  assert.match(catalog, /keys\.size !== exercises\.length/);
  assert.match(page, /loadActiveAdminExerciseCatalog\(admin\.supabase\)/);
  for (const route of routes) {
    assert.match(route, /await getActiveAdminExerciseByKey\(admin\.supabase,/);
  }
  assert.doesNotMatch([page, ...routes].join("\n"), /EXERCISE_CATALOG|getExerciseByKey|lib\/exercises\/catalog/);
});

test("videoclipul nu mai trece prin request body-ul VEMI și este trimis direct la URL-ul R2", async () => {
  const [legacyRoute, client, prepare, r2] = await Promise.all([
    read("app/api/admin/exercise-videos/upload/route.ts"),
    read("app/admin/exercitii-video/video-admin-client.tsx"),
    read("app/api/admin/exercise-videos/upload/prepare/route.ts"),
    read("lib/video/r2.ts"),
  ]);

  assert.match(legacyRoute, /status: 410/);
  assert.doesNotMatch(legacyRoute, /formData\(|arrayBuffer\(/);
  assert.doesNotMatch(client, /new FormData|form\.set\("video"/);
  assert.match(client, /postJson\("\/api\/admin\/exercise-videos\/upload\/prepare"/);
  assert.match(client, /new XMLHttpRequest\(\)/);
  assert.match(client, /request\.open\(upload\.method, upload\.url/);
  assert.match(client, /request\.send\(file\)/);
  assert.match(prepare, /createTemporaryR2UploadUrl/);
  assert.match(r2, /method: "PUT"/);
  assert.match(r2, /signQuery: true/);
  assert.match(r2, /allHeaders: true/);
  assert.match(r2, /"Content-Type": contentType/);
  assert.match(r2, /Math\.min\(600, Math\.max\(60/);
});

test("URL-ul semnat este legat de chei unice, exercițiu, admin și token HMAC cu expirare", async () => {
  const [policy, prepare, verify, posterPrepare, associate, intent, client] = await Promise.all([
    read("lib/video/upload-policy.ts"),
    read("app/api/admin/exercise-videos/upload/prepare/route.ts"),
    read("app/api/admin/exercise-videos/upload/verify/route.ts"),
    read("app/api/admin/exercise-videos/upload/poster/prepare/route.ts"),
    read("app/api/admin/exercise-videos/upload/associate/route.ts"),
    read("lib/video/upload-intent.ts"),
    read("app/admin/exercitii-video/video-admin-client.tsx"),
  ]);

  assert.match(policy, /staging\/exercise-videos\/upload\/\$\{exerciseKey\}\/\$\{mutationId\}\.mp4/);
  assert.match(policy, /staging\/exercise-videos\/verified\/\$\{exerciseKey\}\/\$\{mutationId\}\.mp4/);
  assert.match(policy, /exercises\/\$\{exerciseKey\}\/demo-\$\{mutationId\}\.mp4/);
  assert.match(prepare, /userId: admin\.userId/);
  assert.match(prepare, /exerciseKey: exercise\.exerciseKey/);
  assert.match(prepare, /sha256:/);
  assert.match(intent, /HMAC/);
  assert.match(intent, /R2_WRITE_SECRET_ACCESS_KEY/);
  assert.match(intent, /decoded\.expiresAt/);
  assert.match(intent, /constantTimeEqualHex/);
  assert.match(verify, /intent\.userId !== admin\.userId/);
  assert.match(verify, /intent\.exerciseKey !== exercise\.exerciseKey/);
  assert.match(verify, /intent\.mutationId !== body\.mutationId/);
  assert.match(posterPrepare, /verifiedIntent\.exerciseKey !== exercise\.exerciseKey/);
  assert.match(posterPrepare, /verifiedIntent\.mutationId !== body\.mutationId/);
  assert.match(associate, /intent\.exerciseKey !== exercise\.exerciseKey/);
  assert.match(associate, /intent\.mutationId !== body\.mutationId/);
  assert.match(client, /if \(isBusy\) return;\s*clearPreview\(\);\s*setSelectedKey\(exercise\.exerciseKey\)/);
});

test("verificarea recitește R2, compară SHA-256 și izolează URL-ul reutilizabil de obiectul final", async () => {
  const [verify, validation, r2] = await Promise.all([
    read("app/api/admin/exercise-videos/upload/verify/route.ts"),
    read("lib/video/r2-video-validation.ts"),
    read("lib/video/r2.ts"),
  ]);
  const readIndex = validation.indexOf("readR2Object(");
  const digestIndex = validation.indexOf("sha256Hex(bytes)");
  const codecIndex = validation.indexOf("validateExerciseVideoMp4(bytes)");
  const copyIndex = verify.indexOf("copyR2Object(intent.uploadObjectKey, intent.verifiedObjectKey");
  const verifiedReadIndex = verify.indexOf("validateStoredExerciseVideo(intent.verifiedObjectKey", copyIndex);

  assert.ok(readIndex > -1 && digestIndex > readIndex && codecIndex > digestIndex);
  assert.ok(copyIndex > -1 && verifiedReadIndex > copyIndex);
  assert.match(validation, /headR2Object/);
  assert.match(validation, /MAX_EXERCISE_VIDEO_BYTES/);
  assert.match(validation, /constantTimeEqualHex/);
  assert.match(r2, /x-amz-copy-source/);
  assert.match(verify, /deleteR2Object\(intent\.uploadObjectKey\)/);
});

test("asocierea Supabase are loc numai după verificarea finală și se restaurează la eroare", async () => {
  const [associate, client] = await Promise.all([
    read("app/api/admin/exercise-videos/upload/associate/route.ts"),
    read("app/admin/exercitii-video/video-admin-client.tsx"),
  ]);
  const verifiedIndex = associate.indexOf("validateStoredExerciseVideo(intent.verifiedObjectKey");
  const copyIndex = associate.indexOf("copyR2Object(intent.verifiedObjectKey, intent.finalObjectKey");
  const finalValidationIndex = associate.indexOf("validateStoredExerciseVideo(intent.finalObjectKey");
  const upsertIndex = associate.indexOf(".upsert({", finalValidationIndex);
  const rereadIndex = associate.indexOf("const { data: verifiedRow");

  assert.ok(verifiedIndex > -1 && copyIndex > verifiedIndex);
  assert.ok(finalValidationIndex > copyIndex && upsertIndex > finalValidationIndex);
  assert.ok(rereadIndex > upsertIndex);
  assert.match(associate, /previousRow = currentRow/);
  assert.match(associate, /restorePreviousAssociation/);
  assert.match(associate, /associationAttempted/);
  assert.match(associate, /Videoclipul existent a fost păstrat/);
  assert.match(associate, /previousRow\?\.video_object_key === intent\.finalObjectKey/);
  assert.match(associate, /onConflict: "exercise_key"/);
  assert.match(client, /selected\.status === "available" \? "Înlocuiește videoclipul" : "Încarcă videoclipul"/);
  assert.match(client, /Videoclipul actual rămâne activ dacă noua încărcare eșuează sau este întreruptă/);
});

test("întreruperea, eșecurile și obiectele abandonate au curățare sigură", async () => {
  const [client, abortRoute, r2, verify, associate] = await Promise.all([
    read("app/admin/exercitii-video/video-admin-client.tsx"),
    read("app/api/admin/exercise-videos/upload/abort/route.ts"),
    read("lib/video/r2.ts"),
    read("app/api/admin/exercise-videos/upload/verify/route.ts"),
    read("app/api/admin/exercise-videos/upload/associate/route.ts"),
  ]);
  assert.match(client, /request\.onabort/);
  assert.match(client, /activeXhrRef\.current\?\.abort\(\)/);
  assert.match(client, /cleanupInterruptedUpload/);
  assert.match(client, /upload\/abort/);
  assert.match(abortRoute, /currentRow\?\.video_object_key !== intent\.finalObjectKey/);
  assert.match(abortRoute, /safeDelete\(intent\.uploadObjectKey\)/);
  assert.match(abortRoute, /safeDelete\(intent\.verifiedObjectKey\)/);
  assert.match(r2, /cleanupStaleExerciseVideoUploads/);
  assert.match(r2, /staging\/exercise-videos\//);
  assert.match(verify, /Promise\.all\(\[safeDelete\(intent\.uploadObjectKey\), safeDelete\(intent\.verifiedObjectKey\)\]\)/);
  assert.match(associate, /safeDelete\(intent\.finalObjectKey\)/);
});

test("validatorul acceptă exact 352, 480, 720 și 1080 pătrat, inclusiv fișierul de aproximativ 1,2 MB", async () => {
  const { validateExerciseVideoMp4 } = await loadValidator();
  for (const size of [352, 480, 720, 1080]) {
    const accepted = validateBuffer(validateExerciseVideoMp4, syntheticMp4(size, size));
    assert.equal(accepted.valid, true, `${size} × ${size} trebuie acceptat`);
    assert.equal(accepted.metadata.width, size);
    assert.equal(accepted.metadata.height, size);
  }
  const realistic480 = syntheticMp4(480, 480, "avc1", 1_198_918);
  const realisticResult = validateBuffer(validateExerciseVideoMp4, realistic480);
  assert.equal(realisticResult.valid, true);
  assert.equal(realisticResult.metadata.fileSizeBytes, 1_198_918);

  for (const [width, height] of [[480, 478], [480, 477], [600, 600]]) {
    const rejected = validateBuffer(validateExerciseVideoMp4, syntheticMp4(width, height));
    assert.equal(rejected.valid, false, `${width} × ${height} trebuie respins`);
    assert.equal(rejected.code, "square-video-required");
  }
});

test("validatorul respinge 9:16, 16:9, 4:5, codecul greșit, corupția și peste 25 MB", async () => {
  const { validateExerciseVideoMp4 } = await loadValidator();
  for (const [width, height] of [[480, 854], [360, 640], [1920, 1080], [1080, 1350]]) {
    const rejected = validateBuffer(validateExerciseVideoMp4, syntheticMp4(width, height));
    assert.equal(rejected.valid, false, `${width} × ${height} trebuie respins`);
    assert.equal(rejected.code, "square-video-required");
    assert.match(rejected.message, new RegExp(`${width} × ${height}`));
  }
  const wrongCodec = validateBuffer(validateExerciseVideoMp4, syntheticMp4(480, 480, "hev1"));
  assert.equal(wrongCodec.valid, false);
  assert.equal(wrongCodec.code, "h264-required");
  const corrupt = Buffer.from("not-a-video");
  assert.equal(validateBuffer(validateExerciseVideoMp4, corrupt).code, "invalid-mp4");
  const tooLarge = new ArrayBuffer(25 * 1024 * 1024 + 1);
  const rejectedSize = validateExerciseVideoMp4(tooLarge);
  assert.equal(rejectedSize.valid, false);
  assert.equal(rejectedSize.code, "file-too-large");
});

test("interfața arată toate etapele, progresul, reîncercarea și blochează duplicatele", async () => {
  const [client, styles, policy] = await Promise.all([
    read("app/admin/exercitii-video/video-admin-client.tsx"),
    read("app/globals.css"),
    read("lib/video/upload-policy.ts"),
  ]);
  assert.match(client, /inFlightRef\.current/);
  assert.match(client, /if \(!selected \|\| !preview \|\| inFlightRef\.current\) return/);
  assert.match(client, /crypto\.randomUUID\(\)/);
  assert.match(client, /validateExerciseVideoMp4\(bytes\)/);
  assert.match(client, /sha256Hex\(bytes\)/);
  assert.match(client, /"preparing" \| "uploading" \| "verifying" \| "poster" \| "associating" \| "success" \| "error"/);
  assert.match(client, /setUploadStage\("preparing"\)/);
  assert.match(client, /setUploadStage\("uploading"\)/);
  assert.match(client, /setUploadStage\("verifying"\)/);
  assert.match(client, /setUploadStage\("poster"\)/);
  assert.match(client, /setUploadStage\("associating"\)/);
  assert.match(client, /setUploadStage\("success"\)/);
  assert.match(client, /Reîncearcă încărcarea/);
  assert.match(client, /role="progressbar"/);
  assert.match(client, /<b>\{exercises\.length\}<\/b> active/);
  assert.match(client, /<dt>Cheie canonică<\/dt><dd>\{selected\.exerciseKey\}<\/dd>/);
  assert.match(policy, /352 × 352/);
  assert.match(policy, /480 × 480/);
  assert.match(policy, /acceptedExerciseVideoSizes = new Set\(\[352, 480, 720, 1080\]\)/);
  assert.doesNotMatch(client, /Sunt acceptate și alte rezoluții pătrate/);
  assert.match(styles, /\.admin-video-preview \{[^}]*aspect-ratio: 1 \/ 1/);
  assert.match(styles, /\.admin-video-preview video \{[^}]*object-fit: contain/);
  assert.match(styles, /\.admin-video-upload-progress/);
});

test("succesul apare numai după recitirea Supabase și actualizează placeholderul fără refresh", async () => {
  const [client, associate] = await Promise.all([
    read("app/admin/exercitii-video/video-admin-client.tsx"),
    read("app/api/admin/exercise-videos/upload/associate/route.ts"),
  ]);
  const associationCall = client.indexOf("upload/associate");
  const applyIndex = client.indexOf("applyConfirmedExercise(association.exercise)");
  const successIndex = client.indexOf('setUploadStage("success")', applyIndex);
  assert.ok(associationCall > -1 && applyIndex > associationCall && successIndex > applyIndex);
  const rereadIndex = associate.indexOf("const { data: verifiedRow");
  assert.ok(rereadIndex > -1 && associate.indexOf("adminUploadSuccess({ exercise", rereadIndex) > rereadIndex);
  assert.match(client, /status: "available"/);
  assert.match(client, /setExercises\(\(current\) => current\.map/);
});

test("CORS-ul R2 rămâne limitat la originea VEMI și nu face bucketul public", async () => {
  const [r2, client, prepare, corsPolicy] = await Promise.all([
    read("lib/video/r2.ts"),
    read("app/admin/exercitii-video/video-admin-client.tsx"),
    read("app/api/admin/exercise-videos/upload/prepare/route.ts"),
    read("docs/cloudflare/r2-exercise-video-cors.json"),
  ]);
  const parsedPolicy = JSON.parse(corsPolicy);
  assert.deepEqual(parsedPolicy, [{
    AllowedOrigins: ["https://vemi-fitness.deca-andrei.chatgpt.site"],
    AllowedMethods: ["PUT"],
    AllowedHeaders: ["Content-Type"],
    MaxAgeSeconds: 3600,
  }]);
  assert.match(r2, /probeR2BrowserUploadCors/);
  assert.match(prepare, /R2_CORS_PREFLIGHT_REJECTED/);
  assert.match(prepare, /R2_CORS_PREFLIGHT_UNAVAILABLE/);
  assert.doesNotMatch(prepare, /ensureR2BrowserUploadCors/);
  assert.doesNotMatch(corsPolicy, /"\*"/);
  assert.doesNotMatch(client, /R2_WRITE|SECRET_ACCESS|ACCESS_KEY_ID/);
});

test("interfața separă pregătirea, CORS, semnătura, PUT, verificarea și asocierea", async () => {
  const [client, shared, prepare, verify, associate] = await Promise.all([
    read("app/admin/exercitii-video/video-admin-client.tsx"),
    read("app/api/admin/exercise-videos/upload/_shared.ts"),
    read("app/api/admin/exercise-videos/upload/prepare/route.ts"),
    read("app/api/admin/exercise-videos/upload/verify/route.ts"),
    read("app/api/admin/exercise-videos/upload/associate/route.ts"),
  ]);
  assert.match(shared, /"prepare" \| "cors-preflight" \| "r2-put" \| "verify" \| "poster" \| "associate" \| "abort"/);
  assert.match(client, /R2_SIGNATURE_REJECTED/);
  assert.match(client, /R2_PUT_REJECTED/);
  assert.match(client, /R2_PUT_NETWORK_ERROR/);
  assert.match(client, /R2_UPLOAD_ABORTED/);
  assert.match(prepare, /UPLOAD_PREPARE_FAILED/);
  assert.match(prepare, /R2_CORS_PREFLIGHT_REJECTED/);
  assert.match(verify, /SERVER_VIDEO_VALIDATION_REJECTED/);
  assert.match(associate, /SUPABASE_ASSOCIATION_FAILED/);
});

test("posterul pătrat este generat din primul cadru clar și încărcat direct în R2 după verificarea video", async () => {
  const [client, posterPrepare, policy] = await Promise.all([
    read("app/admin/exercitii-video/video-admin-client.tsx"),
    read("app/api/admin/exercise-videos/upload/poster/prepare/route.ts"),
    read("lib/video/upload-policy.ts"),
  ]);
  const verifyIndex = client.indexOf('postJson("/api/admin/exercise-videos/upload/verify"');
  const generateIndex = client.indexOf("generateExercisePoster(preview.file)", verifyIndex);
  const posterPrepareIndex = client.indexOf('postJson("/api/admin/exercise-videos/upload/poster/prepare"', generateIndex);
  const posterPutIndex = client.indexOf("putDirectlyToR2(posterPreparation.posterUpload", posterPrepareIndex);
  const associateIndex = client.indexOf('postJson("/api/admin/exercise-videos/upload/associate"', posterPutIndex);
  assert.ok(verifyIndex > -1 && generateIndex > verifyIndex && posterPrepareIndex > generateIndex);
  assert.ok(posterPutIndex > posterPrepareIndex && associateIndex > posterPutIndex);
  assert.match(client, /const candidates = \[Math\.min\(0\.18, lastSafeTime\), 0\.45, 0\.9, 1\.5\]/);
  assert.match(client, /average >= 20 && visibleRatio >= 0\.2/);
  assert.match(client, /objectURL|createObjectURL/);
  assert.match(posterPrepare, /validateStoredExerciseVideo\(verifiedIntent\.verifiedObjectKey/);
  assert.match(posterPrepare, /createTemporaryR2UploadUrl\(keys\.posterUploadObjectKey, EXERCISE_POSTER_CONTENT_TYPE\)/);
  assert.match(policy, /finalPosterObjectKey: `exercises\/\$\{exerciseKey\}\/poster-\$\{mutationId\}\.png`/);
});

test("video și poster sunt publicate atomic, iar perechea veche rămâne până la confirmarea Supabase", async () => {
  const [associate, posterValidation] = await Promise.all([
    read("app/api/admin/exercise-videos/upload/associate/route.ts"),
    read("lib/video/r2-poster-validation.ts"),
  ]);
  const oldRead = associate.indexOf("previousRow = currentRow");
  const posterValidationIndex = associate.indexOf("validateStoredExercisePoster(intent.posterUploadObjectKey");
  const finalPosterIndex = associate.indexOf("copyR2Object(intent.posterVerifiedObjectKey, intent.finalPosterObjectKey");
  const upsertIndex = associate.indexOf(".upsert({", finalPosterIndex);
  const rereadIndex = associate.indexOf("const { data: verifiedRow", upsertIndex);
  const deleteOldPoster = associate.indexOf("safeDelete(previousRow.poster_object_key)", rereadIndex);
  assert.ok(oldRead > -1 && posterValidationIndex > oldRead && finalPosterIndex > posterValidationIndex);
  assert.ok(upsertIndex > finalPosterIndex && rereadIndex > upsertIndex);
  assert.ok(deleteOldPoster > rereadIndex);
  assert.doesNotMatch(associate, /safeDelete\(previousRow\.video_object_key\)/);
  assert.match(associate, /poster_object_key: intent\.finalPosterObjectKey/);
  assert.match(associate, /restorePreviousAssociation/);
  assert.match(posterValidation, /headR2Object/);
  assert.match(posterValidation, /readR2Object/);
  assert.match(posterValidation, /constantTimeEqualHex/);
  assert.match(posterValidation, /dimensions\.width !== dimensions\.height/);
});

test("playerul afișează posterul și Play înainte de redare, fără dreptunghi negru", async () => {
  const [component, styles] = await Promise.all([
    read("components/exercise-video.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(component, /preload="metadata"/);
  assert.match(component, /!playRequested && !firstFrameVisible && !closing && \(/);
  assert.match(component, /exercise-video-poster/);
  assert.match(component, /media\.posterUrl/);
  assert.match(component, /video\.play\(\)/);
  assert.match(component, /Vezi demonstrația/);
  assert.match(component, /setPosterLoaded\(false\)/);
  assert.match(component, /requestVideoFrameCallback/);
  assert.match(component, /!decodedFrameReadyRef\.current \|\| !playbackFlowingRef\.current \|\| firstFrameVisibleRef\.current/);
  assert.match(component, /onPlaying=\{\(\) => \{[\s\S]*playbackFlowingRef\.current = true;[\s\S]*revealFirstFrameWhenPlaybackFlows/);
  assert.doesNotMatch(component, /new Image\(\)/);
  assert.doesNotMatch(component, /backgroundImage/);
  assert.doesNotMatch(component, /autoPlay/);
  assert.doesNotMatch(component, /Se pregătește demonstrația|exercise-video-skeleton/);
  assert.match(component, /const modalPresentationReady = status === "missing" \|\| \(/);
  assert.match(component, /await image\.decode\(\)/);
  assert.match(styles, /\.exercise-video-fallback \{[^}]*linear-gradient[^}]*#285747[^}]*#12372b/);
  assert.match(styles, /\.exercise-video-poster-image \{[^}]*object-fit: contain/);
  assert.match(styles, /\.exercise-video-stage video\.is-waiting \{ opacity: 0/);
  assert.match(styles, /\.exercise-video-stage\.is-closing video \{ opacity: 0/);
  assert.match(styles, /\.exercise-video-dialog\.square-only \.exercise-video-stage \{ aspect-ratio: 1 \/ 1/);
});

test("închiderea eliberează resursele, iar redeschiderea pornește din nou de la poster", async () => {
  const component = await read("components/exercise-video.tsx");
  const release = component.slice(component.indexOf("function releaseVideo"), component.indexOf("async function openVideo"));
  assert.match(release, /video\.pause\(\)/);
  assert.match(release, /video\.removeAttribute\("src"\)/);
  assert.match(release, /video\.load\(\)/);
  assert.match(release, /setPlayRequested\(false\)/);
  assert.match(release, /setFirstFrameVisible\(false\)/);
  assert.match(release, /cancelFirstFrameDetection/);
  assert.match(release, /setPosterLoaded\(false\)/);
});

test("backfillul este admin-only, nu schimbă asocierea video și nu creează duplicate", async () => {
  const [client, source, prepare, associate, page] = await Promise.all([
    read("app/admin/exercitii-video/video-admin-client.tsx"),
    read("app/api/admin/exercise-videos/posters/source/[exerciseKey]/route.ts"),
    read("app/api/admin/exercise-videos/posters/backfill/prepare/route.ts"),
    read("app/api/admin/exercise-videos/posters/backfill/associate/route.ts"),
    read("app/admin/exercitii-video/page.tsx"),
  ]);
  for (const route of [source, prepare, associate]) assert.match(route, /getAdminContext\(\)/);
  assert.match(source, /headers: range \? \{ Range: range \}/);
  assert.match(page, /poster_object_key/);
  assert.match(client, /status === "available" && !exercise\.hasPoster/);
  assert.match(client, /Backfill finalizat: \$\{generated\} postere generate, \$\{failed\} eșuate/);
  assert.match(prepare, /if \(row\.poster_object_key\) return adminUploadSuccess\(\{ alreadyGenerated: true \}\)/);
  assert.match(associate, /if \(current\.poster_object_key\)/);
  assert.match(associate, /\.update\(\{ poster_object_key: intent\.finalPosterObjectKey \}\)/);
  assert.doesNotMatch(associate, /video_object_key:/);
  assert.match(associate, /current\.video_object_key !== intent\.finalObjectKey/);
});
