import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const normalizeLines = (value) => value.replaceAll("\r\n", "\n");
const component = normalizeLines(await read("components/exercise-video.tsx"));
const styles = normalizeLines(await read("app/globals.css"));
const page = normalizeLines(await read("components/vemi-page.tsx"));
const modal = component.slice(component.indexOf("{open && createPortal"));
const release = component.slice(component.indexOf("function releaseVideo"), component.indexOf("async function openVideo"));
const open = component.slice(component.indexOf("async function openVideo"), component.indexOf("function markFirstFrameVisible"));

test("1. requestul API nu expune text, spinner, Play sau suprafață intermediară", () => {
  const loadingBranch = modal.slice(modal.indexOf('status === "loading-url"'), modal.indexOf('status === "missing"'));
  assert.doesNotMatch(component, /Se pregătește demonstrația|exercise-video-skeleton/);
  assert.doesNotMatch(loadingBranch, /role="status"|exercise-video-play|data-layer="control"/);
  assert.match(component, /const modalPresentationReady = status === "missing" \|\| \(/);
  assert.match(modal, /modalPresentationReady \? "" : " is-preparing"/);
  assert.match(styles, /\.exercise-video-backdrop\.is-preparing \{[^}]*visibility: hidden;[^}]*opacity: 0;[^}]*pointer-events: none;/);
});

test("2. modalul devine vizibil direct cu posterul și exact un Play circular", () => {
  assert.equal((modal.match(/className=\{`exercise-video-play/g) ?? []).length, 1);
  assert.match(component, /&& \(!media\.posterUrl \|\| posterLoaded \|\| posterFailed\)/);
  assert.match(modal, /status === "ready" && media/);
  assert.match(styles, /\.exercise-video-play \{[^}]*width: 72px;[^}]*height: 72px;[^}]*border-radius: 50%/);
});

test("3. modalul nu conține text vizibil Vezi demonstrația", () => {
  assert.doesNotMatch(modal, />Vezi demonstrația</);
  assert.doesNotMatch(modal, /<span[^>]*>Vezi demonstrația<\/span>/);
});

test("4. butonul legitim care deschide demonstrația rămâne neschimbat", () => {
  const trigger = component.slice(component.indexOf('<button\n        type="button"'), component.indexOf("{open && createPortal"));
  assert.match(trigger, /exercise-video-trigger/);
  assert.match(trigger, /aria-label=\{`Vezi demonstrația pentru \$\{exerciseName\}`\}/);
  assert.match(page, /<ExerciseVideo exerciseKey=\{exercise\.id\} exerciseName=\{exercise\.name\} label="Demonstrație" className="library-video"/);
});

test("5. încărcarea posterului nu înlocuiește controlul Play", () => {
  assert.equal((modal.match(/data-layer="control"/g) ?? []).length, 1);
  assert.doesNotMatch(modal, /posterLoaded\s*\?\s*<button|!posterLoaded\s*&&\s*<button/);
});

test("6. fallbackul, posterul și scena 1:1 au geometrie fixă fără layout shift", () => {
  assert.match(modal, /data-layer="fallback"/);
  assert.match(modal, /data-layer="poster"/);
  assert.match(styles, /\.exercise-video-dialog\.square-only \.exercise-video-stage \{[^}]*aspect-ratio: 1 \/ 1/);
  assert.match(styles, /\.exercise-video-fallback \{[^}]*position: absolute;[^}]*inset: 0/);
  assert.match(styles, /\.exercise-video-fallback \{[^}]*#285747[^}]*#12372b/);
  assert.match(styles, /\.exercise-video-poster-image \{[^}]*position: absolute;[^}]*inset: 0;[^}]*width: 100%;[^}]*height: 100%/);
  assert.doesNotMatch(styles, /\.exercise-video-poster-image \{[^}]*transition:/);
});

test("7. eroarea posterului păstrează fallbackul și același Play circular", () => {
  assert.match(modal, /onError=\{\(\) => \{[\s\S]*setPosterFailed\(true\)/);
  assert.match(modal, /<div className="exercise-video-fallback"/);
  assert.doesNotMatch(styles, /exercise-video-poster\.fallback \.exercise-video-play/);
});

test("8. Play înainte de poster nu este blocat de posterLoaded", () => {
  const playback = component.slice(component.indexOf("async function requestPlayback"), component.indexOf("function usesMobileCustomControls"));
  assert.match(playback, /await video\.play\(\)/);
  assert.doesNotMatch(playback, /posterLoaded|posterFailed/);
});

test("8a. după tap Play controlul dispare fără indicator vizual intermediar", () => {
  const playback = component.slice(component.indexOf("async function requestPlayback"), component.indexOf("function usesMobileCustomControls"));
  assert.match(modal, /!playRequested && !firstFrameVisible && !closing && \(/);
  assert.doesNotMatch(modal, /is-buffering|loading-icon|Se pornește demonstrația/);
  assert.doesNotMatch(styles, /exercise-video-play\.is-buffering|exercise-video-play \.loading-icon/);
  assert.ok(playback.indexOf("setPlayRequested(true)") < playback.indexOf("await video.play()"));
  assert.match(modal, /<div className="exercise-video-fallback"/);
  assert.match(modal, /className=\{`exercise-video-poster-image/);
});

test("8b. toate clipurile păstrează posterul până când cadrul este decodat și redarea curge", () => {
  const reveal = component.slice(component.indexOf("function revealFirstFrameWhenPlaybackFlows"), component.indexOf("function armFirstFrameDetection"));
  assert.match(reveal, /!decodedFrameReadyRef\.current \|\| !playbackFlowingRef\.current \|\| firstFrameVisibleRef\.current/);
  assert.match(reveal, /decodedFrameReadyRef\.current = true/);
  assert.match(modal, /onPlaying=\{\(\) => \{[\s\S]*playbackFlowingRef\.current = true;[\s\S]*revealFirstFrameWhenPlaybackFlows/);
  assert.match(modal, /onWaiting=\{\(\) => \{[\s\S]*if \(!firstFrameVisibleRef\.current\) playbackFlowingRef\.current = false;/);
  assert.match(modal, /onStalled=\{\(\) => \{[\s\S]*if \(!firstFrameVisibleRef\.current\) playbackFlowingRef\.current = false;/);
});

test("8c. pauza pe mobil păstrează cadrul fără control sau icon vizibil", () => {
  const toggle = component.slice(component.indexOf("async function toggleMobilePlayback"), component.indexOf("useEffect(() =>"));
  assert.match(toggle, /video\.paused \|\| video\.ended/);
  assert.match(toggle, /await video\.play\(\)/);
  assert.match(toggle, /video\.pause\(\)/);
  assert.doesNotMatch(toggle, /setPlayRequested|setFirstFrameVisible|playbackAttemptIdRef|requestIdRef|armFirstFrameDetection|cancelFirstFrameDetection/);
  assert.match(modal, /className="exercise-video-mobile-toggle"[\s\S]*aria-label=\{`Redă sau pune pe pauză demonstrația pentru \$\{exerciseName\}`\}[\s\S]*onClick=\{\(\) => void toggleMobilePlayback\(\)\}[\s\S]*\/>/);
  assert.doesNotMatch(component, /mobileVideoPaused|setMobileVideoPaused|exercise-video-mobile-toggle-icon/);
  assert.doesNotMatch(styles, /exercise-video-mobile-toggle-icon|exercise-video-mobile-toggle\.is-paused/);
});

test("9. video rămâne ascuns înainte de firstFrameVisible și în timpul close", () => {
  assert.match(modal, /firstFrameVisible && !closing \? "is-playing" : "is-waiting"/);
  assert.match(styles, /\.exercise-video-stage video\.is-waiting \{ opacity: 0/);
  assert.match(styles, /\.exercise-video-stage\.is-closing video \{ opacity: 0/);
});

test("10. primul frame confirmat face video vizibil fără a schimba geometria scenei", () => {
  assert.match(component, /requestVideoFrameCallback/);
  assert.match(component, /loadeddata/);
  assert.match(component, /requestAnimationFrame/);
  assert.match(component, /decodedFrameReadyRef\.current = true/);
  assert.match(component, /playbackFlowingRef\.current = true/);
  assert.match(component, /firstFrameVisibleRef\.current = true;[\s\S]*setFirstFrameVisible\(true\)/);
  assert.match(styles, /\.exercise-video-stage video\.is-playing \{ opacity: 1/);
});

test("11. close înainte de poster invalidează requestul și callbackurile", () => {
  assert.ok(release.indexOf("requestIdRef.current += 1") < release.indexOf("setClosing(true)"));
  assert.match(release, /fetchControllerRef\.current\?\.abort\(\)/);
  assert.match(release, /cancelFirstFrameDetection\(video\)/);
});

test("12. close în metadata load face cleanup complet", () => {
  assert.match(modal, /preload="metadata"/);
  assert.match(release, /video\.pause\(\)/);
  assert.match(release, /video\.removeAttribute\("src"\)/);
  assert.match(release, /video\.load\(\)/);
});

test("13. close în playback acoperă video înainte de resetarea sursei", () => {
  assert.ok(release.indexOf("flushSync(() => setClosing(true))") < release.indexOf("video.pause()"));
  assert.ok(release.indexOf('video.removeAttribute("src")') < release.indexOf("flushSync(() => setOpen(false))"));
  assert.match(modal, /className=\{`exercise-video-stage\$\{closing \? " is-closing" : ""\}`\}/);
});

test("14. redeschiderea rapidă pornește dintr-o stare vizuală curată", () => {
  for (const reset of ["setClosing(false)", "setPosterLoaded(false)", "setPlayRequested(false)", "setFirstFrameVisible(false)", "setPlaybackError(false)"]) {
    assert.match(open, new RegExp(reset.replace(/[()]/g, "\\$&")));
  }
});

test("15. exercițiul anterior nu poate actualiza media sau UI-ul nou", () => {
  assert.match(component, /media\.requestId !== requestIdRef\.current/);
  assert.match(component, /attemptId !== playbackAttemptIdRef\.current/);
  assert.match(component, /requestId !== requestIdRef\.current/);
});

test("16. biblioteca nu conține video sau preload global", () => {
  assert.doesNotMatch(page, /<video\b|preload="metadata"/);
  assert.equal((component.match(/preload="metadata"/g) ?? []).length, 1);
});

test("17. numai videoclipul selectat poate monta video cu metadata preload", () => {
  assert.match(modal, /status === "ready" && media/);
  assert.match(modal, /src=\{media\.url\}/);
  assert.equal((modal.match(/<video\b/g) ?? []).length, 1);
  assert.equal((modal.match(/preload="metadata"/g) ?? []).length, 1);
});
