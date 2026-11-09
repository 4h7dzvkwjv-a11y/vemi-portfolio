import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("migrarea video păstrează R2 privat și protejează metadatele prin RLS", async () => {
  const [migration, hosting] = await Promise.all([
    read("supabase/migrations/202608040004_vemi_exercise_videos.sql"),
    read(".openai/hosting.json"),
  ]);

  assert.match(migration, /create table public\.exercise_videos/);
  assert.match(migration, /exercise_key text primary key\s+references public\.exercises\(exercise_key\)/);
  assert.match(migration, /alter table public\.exercise_videos enable row level security/);
  assert.match(migration, /exercise_videos_read_active/);
  assert.match(migration, /using \(public\.is_admin\(\)\)/);
  assert.match(migration, /default false/);
  assert.doesNotMatch(migration, /insert into public\.exercise_videos/i);
  assert.match(hosting, /"r2": null/);
});

test("URL-urile R2 sunt semnate numai pe server și expiră în maximum 15 minute", async () => {
  const [signer, route, diagnostics] = await Promise.all([
    read("lib/video/r2.ts"),
    read("app/api/exercises/[exerciseKey]/video/route.ts"),
    read("app/api/exercises/[exerciseKey]/video/diagnostics.ts"),
  ]);

  assert.match(signer, /import "server-only"/);
  assert.match(signer, /R2_READ_ACCESS_KEY_ID/);
  assert.match(signer, /R2_READ_SECRET_ACCESS_KEY/);
  assert.match(signer, /Math\.min\(900/);
  assert.match(signer, /AwsV4Signer/);
  assert.match(signer, /service: "s3"/);
  assert.match(signer, /region: "auto"/);
  assert.match(signer, /signQuery: true/);
  assert.match(signer, /X-Amz-Expires/);
  assert.doesNotMatch(signer, /@aws-sdk/);
  assert.match(route, /dynamic = "force-dynamic"/);
  assert.match(diagnostics, /"Cache-Control": "private, no-store, max-age=0"/);
  assert.match(route, /\.eq\("exercise_key", exerciseKey\)/);
  assert.match(route, /exercise:exercises!inner\(canonical_name\)/);
  assert.match(route, /format.*=== "square"/);
  assert.match(route, /isSquareExerciseVideo\(video\.width_pixels, video\.height_pixels\)/);
  assert.match(route, /square-video-required/);
  assert.ok(route.indexOf("isSquareExerciseVideo(video.width_pixels, video.height_pixels)") < route.indexOf("createTemporaryR2ReadUrl(video.video_object_key)"));
  assert.doesNotMatch(route, /R2_READ_SECRET_ACCESS_KEY/);
});

test("componenta video încarcă la cerere, folosește poster și eliberează playerul", async () => {
  const [component, styles] = await Promise.all([
    read("components/exercise-video.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(component, /fetch\(`\/api\/exercises\/\$\{encodeURIComponent\(exerciseKey\)\}\/video\?format=square`/);
  assert.match(component, /flushSync/);
  assert.match(component, /createPortal/);
  assert.match(component, /document\.body/);
  assert.match(component, /useLayoutEffect/);
  assert.match(component, /loading-url/);
  assert.doesNotMatch(component, /loading-poster/);
  assert.doesNotMatch(component, /new Image\(\)/);
  assert.match(component, /preload="metadata"/);
  assert.match(component, /playsInline/);
  assert.match(component, /muted/);
  assert.match(component, /<img[\s\S]*src=\{media\.posterUrl\}/);
  assert.doesNotMatch(component, /backgroundImage/);
  assert.match(component, /exercise-video-poster/);
  assert.match(component, /video\.play\(\)/);
  assert.match(component, /Vezi demonstrația/);
  assert.match(component, /playRequested/);
  assert.match(component, /firstFrameVisible/);
  assert.match(component, /playbackError/);
  assert.equal((component.match(/<img\b/g) ?? []).length, 1);
  assert.doesNotMatch(component, /new Promise/);
  assert.match(component, /requestVideoFrameCallback/);
  assert.match(component, /loadeddata/);
  assert.match(component, /requestAnimationFrame/);
  assert.match(component, /cancelVideoFrameCallback/);
  assert.match(component, /process\.env\.NODE_ENV === "production"/);
  for (const lifecycleEvent of ["modal-open", "api-start", "api-response", "poster-visible", "tap-play", "loadstart", "loadedmetadata", "loadeddata", "canplay", "first-frame", "playing", "waiting", "stalled", "error"]) {
    assert.match(component, new RegExp(`"${lifecycleEvent}"`));
  }
  assert.match(component, /metric: "api-response" \| "poster" \| "first-frame"/);
  assert.match(component, /body\.style\.overflow = "hidden"/);
  assert.match(component, /body\.style\.paddingRight/);
  assert.match(component, /video\.removeAttribute\("src"\)/);
  assert.match(component, /querySelector\("source"\)\?\.removeAttribute\("src"\)/);
  assert.match(component, /Videoclipul nu este încă disponibil/);
  assert.match(styles, /\.exercise-video-stage \{[^}]*aspect-ratio: 16 \/ 9/);
  assert.match(styles, /\.exercise-video-stage video,[\s\S]*object-fit: contain/);
  assert.match(styles, /width: min\(760px, 100%\)/);
  assert.match(styles, /\.exercise-video-dialog\.square-only \.exercise-video-stage \{[^}]*aspect-ratio: 1 \/ 1/);
  assert.match(styles, /\.exercise-video-dialog\.square-only \.exercise-video-stage \{[^}]*background: linear-gradient/);
  assert.match(styles, /\.exercise-video-fallback \{[^}]*z-index: 1;[^}]*linear-gradient/);
  assert.match(styles, /\.exercise-video-poster-image \{[^}]*z-index: 2;[^}]*background: transparent/);
  assert.match(styles, /\.exercise-video-stage video \{ z-index: 3/);
  assert.match(styles, /\.exercise-video-play \{[^}]*z-index: 4;[^}]*width: 72px;[^}]*height: 72px/);
  assert.match(styles, /\.exercise-video-dialog\.square-only \{[^}]*width: min\(560px/);
  assert.match(styles, /@media \(max-width: 600px\) \{\s*\.exercise-video-dialog\.square-only \.exercise-video-play \.play-icon \{[^}]*border-left: 16px solid #fff;[^}]*font-size: 0;/s);
  assert.doesNotMatch(styles, /@media \(min-width:[^)]+\)[\s\S]{0,300}\.exercise-video-poster\.has-image \.exercise-video-play i/);
  assert.match(component, /video\?format=square/);
  assert.match(component, /className="exercise-video-dialog square-only"/);
  assert.match(component, /Videoclipul pătrat este în curs de pregătire/);
  assert.match(component, /nu respectă noul format 1:1/);
});

test("demonstrația pătrată folosește controale personalizate numai pe telefon", async () => {
  const [component, styles] = await Promise.all([
    read("components/exercise-video.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(component, /MOBILE_DEMO_MEDIA_QUERY = "\(max-width: 600px\)"/);
  assert.match(component, /return window\.matchMedia\(MOBILE_DEMO_MEDIA_QUERY\)\.matches/);
  assert.match(component, /controls=\{firstFrameVisible && !mobileCustomControls\}/);
  assert.match(component, /firstFrameVisible && mobileCustomControls/);
  assert.match(component, /exercise-video-mobile-toggle/);
  assert.match(component, /video\.paused \|\| video\.ended/);
  assert.match(component, /await video\.play\(\)/);
  assert.match(component, /video\.pause\(\)/);
  assert.match(component, /aria-label=\{`Redă sau pune pe pauză demonstrația pentru \$\{exerciseName\}`\}/);
  assert.doesNotMatch(component, /mobileVideoPaused|setMobileVideoPaused|exercise-video-mobile-toggle-icon/);
  assert.match(component, /playsInline/);
  assert.match(component, /preload="metadata"/);
  assert.match(component, /!decodedFrameReadyRef\.current \|\| !playbackFlowingRef\.current \|\| firstFrameVisibleRef\.current/);
  assert.match(component, /onPlaying=\{\(\) => \{[\s\S]*playbackFlowingRef\.current = true;[\s\S]*revealFirstFrameWhenPlaybackFlows/);
  assert.doesNotMatch(component, /setTimeout/);
  assert.doesNotMatch(styles, /::-webkit-media-controls/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*\.exercise-video-dialog\.square-only \.exercise-video-mobile-toggle \{/);
  assert.match(styles, /\.exercise-video-mobile-toggle \{ display: none; \}/);
  assert.doesNotMatch(styles, /exercise-video-mobile-toggle-icon|exercise-video-mobile-toggle\.is-paused/);
});

test("toate demonstrațiile publice folosesc playerul canonic pătrat și rulează nativ în buclă", async () => {
  const [component, page] = await Promise.all([
    read("components/exercise-video.tsx"),
    read("components/vemi-page.tsx"),
  ]);

  assert.match(component, /\sloop\s/);
  assert.match(component, /controls=\{firstFrameVisible && !mobileCustomControls\}/);
  assert.match(component, /preload="metadata"/);
  assert.match(component, /playsInline/);
  assert.doesNotMatch(component, /onPause=\{[^}]*setMobileVideoPaused/);
  assert.match(component, /await video\.play\(\)/);
  assert.doesNotMatch(component, /format\??:|format ===|format !==/);
  assert.doesNotMatch(component, /onEnded=\{[^}]*video\.play/s);
  assert.match(component, /!playRequested && !firstFrameVisible && !closing && \(/);
  assert.match(component, /exercise-video-play/);
  assert.doesNotMatch(page, /format="square"/);
  assert.match(page, /className="library-video"/);
});

test("aceeași componentă canonică este folosită în bibliotecă, planuri, carnet și Antrenamentul meu", async () => {
  const page = await read("components/vemi-page.tsx");

  assert.match(page, /<ExerciseVideo exerciseKey=\{exercise\.exerciseKey\} exerciseName=\{exercise\.name\} className="compact"/);
  assert.match(page, /<ExerciseVideo exerciseKey=\{exercise\.exerciseKey\} exerciseName=\{exercise\.name\} className="play"/);
  assert.match(page, /<ExerciseVideo exerciseKey=\{exercise\.id\} exerciseName=\{exercise\.name\} className="notebook-video"/);
  assert.match(page, /<ExerciseVideo exerciseKey=\{exercise\.id\} exerciseName=\{exercise\.name\} label="Demonstrație" className="library-video"/);
});

test("un exercise_key generic primește automat playerul final fără configurare per exercițiu", async () => {
  const [component, page] = await Promise.all([
    read("components/exercise-video.tsx"),
    read("components/vemi-page.tsx"),
  ]);

  assert.doesNotMatch(component, /exerciseKey\s*===|exerciseKey\s*!==|switch\s*\(exerciseKey\)/);
  assert.match(component, /encodeURIComponent\(exerciseKey\)/);
  assert.match(component, /video\?format=square/);
  assert.match(component, /className="exercise-video-dialog square-only"/);
  assert.match(component, /\sloop\s/);
  assert.equal((page.match(/<ExerciseVideo /g) ?? []).length, 4);
});

test("biblioteca Exerciții acceptă exclusiv metadate video pătrate 1:1", async () => {
  const aspectRatio = await read("lib/video/aspect-ratio.ts");

  assert.match(aspectRatio, /SQUARE_EXERCISE_VIDEO_RATIO = 1/);
  assert.match(aspectRatio, /SQUARE_EXERCISE_VIDEO_PIXEL_TOLERANCE = 2/);
  assert.match(aspectRatio, /Math\.abs\(widthPixels - heightPixels\)/);
  assert.match(aspectRatio, /Math\.abs\(ratio - SQUARE_EXERCISE_VIDEO_RATIO\)/);
});

test("interfața bibliotecii nu mai păstrează mesaje sau ramuri pentru standardul 9:16", async () => {
  const files = await Promise.all([
    read("app/admin/exercitii-video/page.tsx"),
    read("app/admin/exercitii-video/video-admin-client.tsx"),
    read("app/api/exercises/[exerciseKey]/video/route.ts"),
    read("components/exercise-video.tsx"),
    read("lib/video/mp4-validator.ts"),
    read("lib/video/upload-policy.ts"),
  ]);
  const source = files.join("\n");

  assert.doesNotMatch(source, /9\s*:\s*16|9\s*\/\s*16/);
  assert.doesNotMatch(source, /vertical-video-required|vertical-only|orientation=vertical/);
});

test("videoclipurile vechi incompatibile primesc placeholder înainte de semnarea URL-ului", async () => {
  const [route, component, adminPage] = await Promise.all([
    read("app/api/exercises/[exerciseKey]/video/route.ts"),
    read("components/exercise-video.tsx"),
    read("app/admin/exercitii-video/page.tsx"),
  ]);

  assert.match(route, /reason: "square-video-required"/);
  assert.ok(route.indexOf("square-video-required") < route.indexOf("createTemporaryR2ReadUrl(video.video_object_key)"));
  assert.match(component, /setMissingReason\("square-video-required"\)/);
  assert.match(component, /setStatus\("ready"\)/);
  assert.match(adminPage, /compatible \? "available" as const : "incompatible" as const/);
});

test("scrierea R2 rămâne exclusiv server-side și nu schimbă tokenul de citire", async () => {
  const [r2, publicRoute, publicPlayer, adminClient] = await Promise.all([
    read("lib/video/r2.ts"),
    read("app/api/exercises/[exerciseKey]/video/route.ts"),
    read("components/exercise-video.tsx"),
    read("app/admin/exercitii-video/video-admin-client.tsx"),
  ]);

  assert.match(r2, /import "server-only"/);
  assert.match(r2, /R2_READ_ACCESS_KEY_ID/);
  assert.match(r2, /R2_WRITE_ACCESS_KEY_ID/);
  assert.match(r2, /R2_WRITE_SECRET_ACCESS_KEY/);
  assert.match(r2, /uploadR2Object/);
  assert.doesNotMatch(publicRoute, /R2_WRITE|uploadR2Object/);
  assert.doesNotMatch(publicPlayer, /R2_WRITE|uploadR2Object/);
  assert.doesNotMatch(adminClient, /R2_WRITE|SECRET_ACCESS|ACCESS_KEY_ID/);
});
