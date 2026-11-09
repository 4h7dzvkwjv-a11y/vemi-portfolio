import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const readProjectFile = (path) => readFile(new URL(path, projectRoot), "utf8");

const countToken = (source, token) => source.split(token).length - 1;

const assertTokensInOrder = (source, tokens) => {
  let previousIndex = -1;

  for (const token of tokens) {
    assert.equal(countToken(source, token), 1, `Expected exactly one ${token}`);
    const currentIndex = source.indexOf(token);
    assert.ok(currentIndex > previousIndex, `Expected ${token} after the previous structural marker`);
    previousIndex = currentIndex;
  }
};

const extractConstArray = (source, name) => {
  const startToken = `const ${name} = [`;
  const endToken = "] as const;";
  const startIndex = source.indexOf(startToken);
  assert.notEqual(startIndex, -1, `Expected ${name} array`);
  const endIndex = source.indexOf(endToken, startIndex);
  assert.notEqual(endIndex, -1, `Expected ${name} array terminator`);
  return source.slice(startIndex, endIndex + endToken.length);
};

const extractStringField = (source, field) => [
  ...source.matchAll(new RegExp(`${field}: "([^"]+)"`, "g")),
].map((match) => match[1]);

const extractMarkedBlock = (source, marker, nextMarker) => {
  const markerToken = `data-figma-node="${marker}"`;
  const markerIndex = source.indexOf(markerToken);
  assert.notEqual(markerIndex, -1, `Expected section marker ${marker}`);
  const startIndex = source.lastIndexOf("<", markerIndex);
  const nextMarkerIndex = nextMarker
    ? source.indexOf(`data-figma-node="${nextMarker}"`, markerIndex + markerToken.length)
    : -1;
  const endIndex = nextMarkerIndex === -1 ? source.length : source.lastIndexOf("<", nextMarkerIndex);
  return source.slice(startIndex, endIndex);
};

const extractBetween = (source, startToken, endToken) => {
  const startIndex = source.indexOf(startToken);
  assert.notEqual(startIndex, -1, `Expected ${startToken}`);
  const endIndex = source.indexOf(endToken, startIndex + startToken.length);
  assert.notEqual(endIndex, -1, `Expected ${endToken} after ${startToken}`);
  return source.slice(startIndex, endIndex + endToken.length);
};

const extractElementWithAttribute = (source, tag, attribute) => {
  const attributeIndex = source.indexOf(attribute);
  assert.notEqual(attributeIndex, -1, `Expected ${attribute}`);
  const startIndex = source.lastIndexOf(`<${tag}`, attributeIndex);
  assert.notEqual(startIndex, -1, `Expected <${tag}> for ${attribute}`);
  const endToken = `</${tag}>`;
  const endIndex = source.indexOf(endToken, attributeIndex + attribute.length);
  assert.notEqual(endIndex, -1, `Expected ${endToken} for ${attribute}`);
  return source.slice(startIndex, endIndex + endToken.length);
};

const assertLabelledHeading = (source, id) => {
  assert.match(source, new RegExp(`aria-labelledby="${id}"`));
  assert.match(source, new RegExp(`<h[1-3][^>]*id="${id}"`));
};

test("mobile homepage mounts one complete eight-section V2 contract", async () => {
  const [page, mobileHome, mobileCss] = await Promise.all([
    readProjectFile("components/vemi-page.tsx"),
    readProjectFile("components/vemi-homepage-mobile.tsx"),
    readProjectFile("components/vemi-homepage-mobile-v2.module.css"),
  ]);
  const assetRoot = "public/assets/home-mobile/homepage-v2/";
  await Promise.all([
    access(new URL(`${assetRoot}exercise-guide-approved.jpg`, projectRoot)),
    access(new URL(`${assetRoot}library-articles.svg`, projectRoot)),
    access(new URL(`${assetRoot}library-books-stack-v2.png`, projectRoot)),
    access(new URL(`${assetRoot}recommendations-intolerances.svg`, projectRoot)),
  ]);
  const exerciseAsset = await readFile(new URL(`${assetRoot}exercise-guide-approved.jpg`, projectRoot));

  assert.equal((page.match(/<VemiHomepageMobile\b/g) ?? []).length, 1);
  assert.equal((mobileHome.match(/export function VemiHomepageMobile\b/g) ?? []).length, 1);
  assert.equal(countToken(mobileHome, 'id="vemi-home-mobile"'), 1);
  assert.equal(countToken(mobileHome, 'data-homepage-chapter="one-v2"'), 1);
  assert.doesNotMatch(page, /<VemiHomepageChapterOneV2\b/);
  assert.doesNotMatch(mobileHome, /<VemiHomepageChapterOneV2\b/);

  const structuralMarkers = [
    'data-figma-node="318:6"',
    'data-figma-node="318:9"',
    'data-figma-node="318:18"',
    'data-figma-node="318:46"',
    'data-figma-node="318:60"',
    'data-figma-node="318:99"',
    'data-figma-node="318:146"',
    'data-figma-node="318:165"',
    'data-figma-node="318:209"',
  ];
  assertTokensInOrder(mobileHome, structuralMarkers);

  const hero = extractMarkedBlock(mobileHome, "318:9", "318:18");
  const pillarsSection = extractMarkedBlock(mobileHome, "318:18", "318:46");
  const workout = extractMarkedBlock(mobileHome, "318:46", "318:60");
  const choices = extractMarkedBlock(mobileHome, "318:60", "318:99");
  const library = extractMarkedBlock(mobileHome, "318:99", "318:146");
  const exercise = extractMarkedBlock(mobileHome, "318:146", "318:165");
  const recommendations = extractMarkedBlock(mobileHome, "318:165", "318:209");
  const chat = extractMarkedBlock(mobileHome, "318:209");

  assertLabelledHeading(hero, "vemi-v2-hero-title");
  assert.match(hero, /Un program clar\./);
  assert.match(hero, /Mai ușor de urmat\./);
  assert.match(hero, /Planuri de antrenament gratuite/);
  assert.match(hero, /<Link\b[^>]*href="\/planuri-gratuite"/);
  assert.match(hero, /Alege programul gratuit/);

  assert.match(pillarsSection, /aria-label="Direcțiile VEMI"/);
  const pillarsSource = extractConstArray(mobileHome, "pillars");
  assert.deepEqual(extractStringField(pillarsSource, "title"), ["Viață", "Energie", "Mișcare"]);
  assert.deepEqual(extractStringField(pillarsSource, "href"), [
    "/stil-de-viata",
    "/alimentatie",
    "/exercitii",
  ]);
  assert.match(pillarsSection, /pillars\.map/);
  const pillarLink = pillarsSection.match(/<Link\b[^>]*>/)?.[0];
  assert.ok(pillarLink, "Expected whole-card pillar link");
  assert.match(pillarLink, /className=\{styles\.pillarCard\}/);
  assert.match(pillarLink, /href=\{pillar\.href\}/);
  assert.match(pillarsSection, /<DoubleChevron\s*\/>/);
  const doubleChevron = extractBetween(mobileHome, "function DoubleChevron", "function ActionArrow");
  assert.match(doubleChevron, /aria-hidden="true"/);

  assertLabelledHeading(workout, "vemi-v2-workout-title");
  assert.equal(countToken(mobileHome, "className={styles.workoutCard}"), 1);
  assert.equal((mobileHome.match(/Antrenamentul meu/g) ?? []).length, 1);
  assert.match(workout, /workout-dumbbell\.png/);
  assert.match(workout, /Creează un antrenament/);
  assert.match(workout, /onClick=\{onOpenWorkoutCreator\}/);

  assertLabelledHeading(choices, "vemi-v2-choices-title");
  assert.match(choices, /Patru alegeri\./);
  assert.match(choices, /Programul tău\./);
  assert.match(choices, /four-choices-checklist\.png/);
  assert.match(choices, /steps\.map/);
  const stepsSource = extractConstArray(mobileHome, "steps");
  assert.deepEqual(extractStringField(stepsSource, "number"), ["01", "02", "03", "04"]);
  assert.equal(extractStringField(stepsSource, "copy").length, 4);

  assertLabelledHeading(library, "vemi-v2-library-title");
  assert.match(library, /Biblioteca VEMI/);
  assert.match(library, /library-books-stack-v2\.png/);
  const libraryCategoriesSource = extractConstArray(mobileHome, "libraryCategories");
  assert.match(
    libraryCategoriesSource,
    /\{\s*label:\s*"Articole",\s*icon:\s*"library-articles\.svg"\s*\}/,
  );
  assert.deepEqual(extractStringField(libraryCategoriesSource, "label"), [
    "Stil de viață",
    "Alimentație",
    "Stres",
    "Calculator calorii",
    "Rețete",
    "Articole",
  ]);
  const libraryRoutes = extractStringField(libraryCategoriesSource, "href");
  const categoryRoutes = [
    "/stil-de-viata",
    "/alimentatie",
    "/stil-de-viata/stresul",
    "/alimentatie/calculator-caloric",
    "/alimentatie/retete-simple",
  ];
  assert.deepEqual(libraryRoutes, categoryRoutes);
  assert.match(library, /libraryCategories\.map/);
  assert.match(library, /<Link\b[^>]*href=\{category\.href\}/);
  assert.equal(countToken(library, 'data-planned-library-tile="articles"'), 1);
  const articlesTile = extractElementWithAttribute(
    library,
    "div",
    'data-planned-library-tile="articles"',
  );
  assert.doesNotMatch(articlesTile, /<Link\b|href=|\brole=|\btabIndex=|\bonClick=|\bonKeyDown=|\bonKeyUp=/);
  const libraryMainCard = extractBetween(library, "<article className={styles.splitCard}>", "</article>");
  assert.doesNotMatch(libraryMainCard, /<Link\b|href=/);
  assert.match(libraryMainCard, /<DoubleChevron\b[^>]*className=\{styles\.splitChevron\}/);

  assertLabelledHeading(exercise, "vemi-v2-exercise-title");
  assert.match(exercise, /Învață mișcarea\./);
  assert.match(exercise, /Execută sigur\./);
  assert.match(exercise, /exercise-guide-approved\.jpg/);
  assert.doesNotMatch(exercise, /exercise-guide(?:-v2)?\.(?:svg|png)/);
  assert.deepEqual([...exerciseAsset.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  assert.deepEqual([...exerciseAsset.subarray(-2)], [0xff, 0xd9]);
  assert.match(exercise, /Demonstrații clare/);
  assert.match(exercise, /<Link\b[^>]*href="\/exercitii"/);
  assert.match(exercise, /Descoperă exercițiile/);

  assertLabelledHeading(recommendations, "vemi-v2-recommendations-title");
  assert.match(recommendations, /Ghiduri/);
  assert.match(recommendations, /practice/);
  assert.match(recommendations, /recommendations-guide\.png/);
  const recommendationCategoriesSource = extractConstArray(mobileHome, "recommendationCategories");
  assert.match(
    recommendationCategoriesSource,
    /\{\s*label:\s*"Intoleranțe",\s*icon:\s*"recommendations-intolerances\.svg",\s*tone:\s*"intolerances"\s*\}/,
  );
  assert.deepEqual(extractStringField(recommendationCategoriesSource, "label"), [
    "Stil de viață",
    "Alimentație",
    "Stres",
    "Calculator calorii",
    "Rețete",
    "Intoleranțe",
  ]);
  const recommendationRoutes = extractStringField(recommendationCategoriesSource, "href");
  assert.deepEqual(recommendationRoutes, categoryRoutes);
  assert.match(recommendations, /recommendationCategories\.map/);
  assert.match(recommendations, /<Link\b[^>]*href=\{category\.href\}/);
  assert.equal(countToken(recommendations, 'data-planned-recommendation-pill="intolerances"'), 1);
  const intolerancesPill = extractElementWithAttribute(
    recommendations,
    "div",
    'data-planned-recommendation-pill="intolerances"',
  );
  assert.doesNotMatch(intolerancesPill, /<Link\b|href=|\brole=|\btabIndex=|\bonClick=|\bonKeyDown=|\bonKeyUp=/);
  const recommendationsMainCard = extractBetween(
    recommendations,
    '<article className={`${styles.splitCard} ${styles.recommendationsCard}`}>',
    "</article>",
  );
  assert.doesNotMatch(recommendationsMainCard, /<Link\b|href=/);
  assert.match(recommendationsMainCard, /<DoubleChevron\b[^>]*className=\{styles\.splitChevron\}/);

  assertLabelledHeading(chat, "vemi-v2-chat-title");
  assert.equal(countToken(mobileHome, 'const CHAT_VEMI_CTA_HREF = "/abonamente";'), 1);
  assert.match(chat, /Deschide Chat VEMI/);
  assert.match(chat, /href=\{CHAT_VEMI_CTA_HREF\}/);
  assert.match(chat, /className=\{styles\.chatPreview\} aria-hidden="true"/);
  assert.match(chat, /chatTopics\.map/);
  assert.deepEqual(extractStringField(extractConstArray(mobileHome, "chatTopics"), "label"), [
    "Antrenamente",
    "Alimentație",
    "Stil de viață",
  ]);
  assert.doesNotMatch(chat, /<(?:form|input|textarea|select)\b|onSubmit=|onChange=/);
  assert.doesNotMatch(mobileHome, /\b(?:useState|useEffect|WebSocket|EventSource)\b|fetch\s*\(/);
  assert.doesNotMatch(mobileHome, /["']\/chat(?:["'/?#]|\/)/);

  assert.doesNotMatch(mobileHome, /className="vhm-section vhm-hero"/);
  assert.doesNotMatch(mobileHome, /className="vhm-section vhm-workout"/);
  assert.doesNotMatch(mobileHome, /Creează planul tău/);
  assert.doesNotMatch(mobileHome, /\["96"[\s\S]*\["4"[\s\S]*\["0"/);

  assert.equal(
    countToken(mobileHome, 'const asset = (name: string) => `/assets/home-mobile/homepage-v2/${name}`;'),
    1,
  );
  assert.doesNotMatch(mobileHome, /https?:\/\/[^"']*(?:figma|localhost)|figmausercontent/);
  for (const [section, image] of [
    [choices, "four-choices-checklist.png"],
    [library, "library-books-stack-v2.png"],
    [exercise, "exercise-guide-approved.jpg"],
    [recommendations, "recommendations-guide.png"],
  ]) {
    assert.match(section, new RegExp(`src=\\{asset\\("${image.replace(".", "\\.")}"\\)\\}[^>]*loading="lazy"`));
  }

  assert.doesNotMatch(mobileCss, /100vw/);
  assert.match(
    mobileCss,
    /\.libraryCategories\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    mobileCss,
    /\.recommendationPills\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(mobileCss, /(?:^|\n)\.page\s*\{[^}]*display:\s*none/s);
  const activeMobileContainer = mobileCss.match(
    /@media\s*\(max-width:\s*720px\)\s*\{\s*:global\(\.vemi-home-mobile\)\.page\s*\{([^}]*)\}/s,
  );
  assert.ok(activeMobileContainer, "Expected the active homepage container inside the mobile breakpoint");
  assert.match(activeMobileContainer[1], /width:\s*100%/);
  assert.match(activeMobileContainer[1], /min-width:\s*0/);
  assert.doesNotMatch(activeMobileContainer[1], /(?:^|\n)\s*transform\s*:/);
});

test("Chapter 1 V2 preserves approved copy, routes and creator callback", async () => {
  const chapter = await readProjectFile("components/vemi-homepage-chapter-one-v2.tsx");

  assert.equal((chapter.match(/data-chapter-one-v2-workout/g) ?? []).length, 1);
  assert.equal((chapter.match(/Antrenamentul meu/g) ?? []).length, 1);
  assert.match(chapter, />Alege programul gratuit</);
  assert.match(chapter, /href="\/planuri-gratuite"/);
  assert.match(chapter, /href: "\/stil-de-viata"/);
  assert.match(chapter, /href: "\/alimentatie"/);
  assert.match(chapter, /href: "\/exercitii"/);
  assert.match(chapter, /onClick=\{onOpenWorkoutCreator\}/);
  assert.doesNotMatch(chapter, /Creează planul tău|\b96\b|\b4\b|\b0\b/);
  assert.doesNotMatch(chapter, /https?:\/\/[^"']*figma|figmausercontent|localhost/);
  assert.doesNotMatch(chapter, /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
});

test("Chapter 1 V2 layout avoids horizontal and transformed-container hacks", async () => {
  const css = await readProjectFile("components/vemi-homepage-chapter-one-v2.module.css");

  assert.doesNotMatch(css, /100vw/);
  assert.doesNotMatch(css, /\.chapter\s*\{[^}]*transform\s*:/s);
  assert.doesNotMatch(css, /(?:html|body|\.home-page|\.vemi-home-mobile)\s*\{[^}]*transform\s*:/s);
  assert.match(css, /\.chapter\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/s);
});
