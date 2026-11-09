import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

const readProjectFile = (path) => readFile(new URL(path, projectRoot), "utf8");

test("every lifestyle entry point targets the real route and the drawer uses normal history navigation", async () => {
  const [drawer, home, mobileHome, account, editorialHeader, editorialFooter] = await Promise.all([
    readProjectFile("components/vemi-navigation-drawer.tsx"),
    readProjectFile("components/vemi-page.tsx"),
    readProjectFile("components/vemi-homepage-mobile.tsx"),
    readProjectFile("app/contul-meu/account-client.tsx"),
    readProjectFile("components/editorial/editorial-header.tsx"),
    readProjectFile("components/editorial/editorial-footer.tsx"),
  ]);

  for (const source of [drawer, home, mobileHome, account, editorialHeader, editorialFooter]) {
    assert.match(source, /(?:href[=:]\s*|href:\s*)["']\/stil-de-viata["']/);
  }
  assert.match(drawer, /navigateFromDrawer\(href\);/);
  assert.match(drawer, /window\.location\.assign\(href\);/);
  assert.doesNotMatch(drawer, /location\.replace|router\.replace|router\.push|openLifestyle/);
});

test("legacy lifestyle drawer code, DOM hooks, styles, listeners and assets are removed", async () => {
  const [page, drawer, css] = await Promise.all([
    readProjectFile("app/stil-de-viata/page.tsx"),
    readProjectFile("components/vemi-navigation-drawer.tsx"),
    readProjectFile("app/globals.css"),
  ]);

  for (const source of [page, drawer, css]) {
    assert.doesNotMatch(source, /LifestyleGateway|LifestyleDrawer|lifestyle-gateway|lifestyle-secondary|data-lifestyle|vemi-lifestyle-secondary-root/);
  }
  assert.doesNotMatch(drawer, /primaryRail|secondaryOpen|setTimeout\([^)]*navigate|scroll:\s*false/);
  assert.doesNotMatch(css, /translate3d\(100dvw|calc\(100% - 11vw\)|lifestyle-gateway-chevron/);

  const removedFiles = [
    "components/lifestyle-gateway.tsx",
    "components/lifestyle-drawer-state.ts",
    "public/lifestyle-gateway-chevrons.svg",
    "public/lifestyle-gateway-symbol.png",
    "public/stil-de-viata-gateway-background.png",
    "public/stil-de-viata-gateway-background.webp",
  ];
  await Promise.all(removedFiles.map((path) => assert.rejects(access(new URL(path, projectRoot)))));
});

test("main VEMI and account drawers retain open, close, swipe, overlay and scroll restoration", async () => {
  const drawer = await readProjectFile("components/vemi-navigation-drawer.tsx");

  assert.match(drawer, /onClick=\{\(\) => setOpen\(true\)\}/);
  assert.match(drawer, /className="vemi-drawer-overlay"[\s\S]*onClick=\{closeDrawer\}/);
  assert.match(drawer, /onPointerDown=\{onPointerDown\}[\s\S]*onPointerMove=\{onPointerMove\}[\s\S]*onPointerUp=\{finishDrag\}/);
  assert.match(drawer, /body\.style\.position = "fixed";/);
  assert.match(drawer, /Object\.assign\(body\.style, bodyStyle\);/);
  assert.match(drawer, /window\.scrollTo\(0, restoreY\);/);
  assert.match(drawer, /className="vemi-drawer-panel vemi-account-drawer-panel"/);
  assert.match(drawer, /onPointerDown=\{onAccountPointerDown\}[\s\S]*onPointerUp=\{finishAccountDrag\}/);
});
