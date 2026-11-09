import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

process.env.NEXT_PUBLIC_SITE_URL ??= "https://example.test";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_test";

const projectRoot = new URL("../", import.meta.url);
const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("editorial-test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const workerEnv = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};
const workerContext = { waitUntil() {}, passThroughOnException() {} };

const publicCategories = [
  "somnul",
  "stresul",
  "munca-si-programul-zilnic",
  "recuperarea",
];

const subscriptionCategories = [
  "antrenamentul",
  "mobilitate-si-preventie",
];

const nutritionCategories = [
  "bazele-alimentatiei",
  "alimentatia-de-zi-cu-zi",
  "alimentatia-pentru-obiectiv",
  "retete-simple",
  "restrictii-si-intolerante",
  "calculator-caloric",
];

const foundationArticles = [
  ["bazele-alimentatiei", "caloriile-ce-sunt-si-de-ce-conteaza"],
  ["bazele-alimentatiei", "proteine-carbohidrati-si-grasimi"],
  ["bazele-alimentatiei", "cum-arata-o-alimentatie-echilibrata"],
  ["bazele-alimentatiei", "calitatea-alimentelor-vs-numarul-de-calorii"],
];

const dailyNutritionArticles = [
  ["alimentatia-de-zi-cu-zi", "cum-iti-organizezi-mesele-intr-o-zi"],
  ["alimentatia-de-zi-cu-zi", "ce-mananci-inainte-si-dupa-antrenament"],
  ["alimentatia-de-zi-cu-zi", "gustarile-cand-ajuta-si-cand-adauga-calorii"],
  ["alimentatia-de-zi-cu-zi", "cum-mananci-mai-bine-cand-ai-putin-timp"],
];

const goalNutritionArticles = [
  ["alimentatia-pentru-obiectiv", "deficitul-caloric-pentru-slabire"],
  ["alimentatia-pentru-obiectiv", "surplusul-caloric-pentru-masa-musculara"],
  ["alimentatia-pentru-obiectiv", "mentinerea-greutatii-si-a-formei"],
  ["alimentatia-pentru-obiectiv", "cum-ajustezi-alimentatia-cand-progresul-se-opreste"],
];

const recipeArticles = [
  ["retete-simple", "10-retete-simple-pentru-slabire"],
  ["retete-simple", "10-retete-simple-pentru-masa-musculara"],
  ["retete-simple", "10-retete-simple-pentru-mentinere"],
];

const restrictionArticles = [
  ["restrictii-si-intolerante", "intoleranta-la-lactoza-si-alimentatia"],
  ["restrictii-si-intolerante", "glutenul-si-alimentatia-fara-gluten"],
  ["restrictii-si-intolerante", "alergii-alimentare-ce-trebuie-sa-ai-in-vedere"],
  ["restrictii-si-intolerante", "dietele-restrictive-si-riscul-de-carente"],
];

const standardNutritionArticles = [...foundationArticles, ...dailyNutritionArticles, ...goalNutritionArticles];
const nutritionArticles = [...standardNutritionArticles, ...recipeArticles, ...restrictionArticles];

const articles = [
  ["somnul", "de-ce-este-somnul-esential"],
  ["somnul", "de-cate-ore-de-somn-ai-nevoie"],
  ["somnul", "somn-putin-sau-somn-de-slaba-calitate"],
  ["somnul", "obosit-desi-ai-dormit-suficient"],
  ["stresul", "cum-afecteaza-stresul-somnul-si-recuperarea"],
  ["stresul", "stres-fizic-versus-stres-psihic"],
  ["stresul", "semne-ca-stresul-te-afecteaza"],
  ["stresul", "cum-reduci-stresul-fara-schimbari-radicale"],
  ["munca-si-programul-zilnic", "programul-de-munca-energia-si-somnul"],
  ["munca-si-programul-zilnic", "de-ce-apare-oboseala-in-timpul-zilei"],
  ["munca-si-programul-zilnic", "cum-iti-organizezi-ziua-pentru-mai-multa-energie"],
  ["munca-si-programul-zilnic", "munca-in-ture-si-programul-neregulat"],
  ["recuperarea", "odihna-inseamna-mai-mult-decat-somn"],
  ["recuperarea", "recuperare-sau-mai-multa-cafea"],
  ["recuperarea", "somnul-energia-pofta-de-mancare-si-antrenamentele"],
  ["recuperarea", "cum-iti-imbunatatesti-recuperarea"],
  ["antrenamentul", "tehnica-exercitiilor-executie-controlata"],
  ["antrenamentul", "cum-iti-structurezi-un-antrenament"],
  ["antrenamentul", "cum-progresezi-fara-sa-schimbi-programul"],
  ["antrenamentul", "cum-adaptezi-antrenamentul-la-obiectiv"],
  ["mobilitate-si-preventie", "ce-inseamna-mobilitatea-si-cata-ai-nevoie"],
  ["mobilitate-si-preventie", "incalzirea-inainte-de-antrenament"],
  ["mobilitate-si-preventie", "semnalele-corpului-in-timpul-antrenamentului"],
  ["mobilitate-si-preventie", "cum-revii-treptat-la-antrenament-dupa-o-pauza"],
];

const publicArticles = articles.filter(([category]) => publicCategories.includes(category));
const subscriptionArticles = articles.filter(([category]) => subscriptionCategories.includes(category));

async function request(path) {
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    workerEnv,
    workerContext,
  );
}

function normalizeRenderedHtml(html) {
  return html.replaceAll("<!-- -->", "");
}

test("editorial catalog contains 24 published articles and no draft state", async () => {
  const catalog = await readFile(new URL("content/stil-de-viata/catalog.ts", projectRoot), "utf8");
  assert.equal((catalog.match(/status: "published"/g) ?? []).length, 24);
  assert.equal((catalog.match(/status: "draft"/g) ?? []).length, 0);
  assert.equal((catalog.match(/legacySlugs: \[\]/g) ?? []).length, 24);
  assert.doesNotMatch(catalog, /În curând|planificate|în pregătire/);
});

test("all 24 MDX articles stay within the editorial length and structure", async () => {
  for (const [category, slug] of articles) {
    const article = await readFile(
      new URL(`content/stil-de-viata/articles/${category}/${slug}.mdx`, projectRoot),
      "utf8",
    );
    const wordCount = article.trim().split(/\s+/).length;
    assert.ok(wordCount >= 500 && wordCount <= 750, `${slug}: ${wordCount} words`);
    assert.ok((article.match(/^## /gm) ?? []).length >= 4, `${slug}: too few sections`);
    assert.match(article, /## Ideea de reținut/);
  }
});

test("nutrition catalog contains six categories and exactly nineteen published articles", async () => {
  const catalog = await readFile(new URL("content/alimentatie/catalog.ts", projectRoot), "utf8");
  assert.equal((catalog.match(/^  \{$/gm) ?? []).length >= 17, true);
  assert.equal((catalog.match(/status: "published"/g) ?? []).length, 19);
  assert.equal((catalog.match(/recommendedSlugs: \[\]/g) ?? []).length, 0);
  assert.doesNotMatch(catalog, /status: "(?:draft|comingSoon)"/);

  let previousIndex = -1;
  for (const [, slug] of nutritionArticles) {
    const catalogIndex = catalog.indexOf(`slug: "${slug}"`);
    assert.ok(catalogIndex > previousIndex, `${slug}: catalog order`);
    previousIndex = catalogIndex;
  }

  for (const [category, slug] of standardNutritionArticles) {
    const article = await readFile(new URL(`content/alimentatie/articles/${category}/${slug}.mdx`, projectRoot), "utf8");
    const wordCount = article.trim().split(/\s+/).length;
    assert.ok(wordCount >= 500 && wordCount <= 750, `${slug}: ${wordCount} words`);
    assert.equal((article.match(/^## /gm) ?? []).length, 8, `${slug}: sections`);
    assert.match(article, /## Când merită să discuți cu un (?:medic sau )?nutriționist/);
    assert.match(article, /## Ideea de reținut/);
  }

  for (const [category, slug] of restrictionArticles) {
    const article = await readFile(new URL(`content/alimentatie/articles/${category}/${slug}.mdx`, projectRoot), "utf8");
    const wordCount = article.trim().split(/\s+/).length;
    assert.ok(wordCount >= 600 && wordCount <= 850, `${slug}: ${wordCount} words`);
    assert.ok((article.match(/^## /gm) ?? []).length >= 7 && (article.match(/^## /gm) ?? []).length <= 9, `${slug}: sections`);
    assert.match(article, /## Când merită să discuți cu un medic sau nutriționist/);
    assert.match(article, /## Ideea de reținut/);
  }
});

test("recipe articles render thirty complete reusable recipe blocks", async () => {
  const seenTitles = new Set();
  let totalBlocks = 0;

  for (const [category, slug] of recipeArticles) {
    const html = normalizeRenderedHtml(await (await request(`/alimentatie/${category}/${slug}`)).text());
    const blocks = [...html.matchAll(/<section class="recipe-block"[\s\S]*?<\/section>/g)].map((match) => match[0]);
    assert.equal(blocks.length, 10, `${slug}: recipe count`);
    totalBlocks += blocks.length;

    for (const block of blocks) {
      assert.match(block, /<h4>Ingrediente<\/h4>[\s\S]*?<ul><li>/);
      assert.match(block, /<h4>Mod de preparare<\/h4>[\s\S]*?<ol><li>/);
      assert.match(block, /<dt>Porție<\/dt>[\s\S]*?<dd>\d+ porți/);
      assert.match(block, /<dt>Calorii aproximative<\/dt>[\s\S]*?~\d+ kcal \/ porție/);
      assert.match(block, /<dt>Proteine aproximative<\/dt>[\s\S]*?~\d+ g \/ porție/);
      const title = block.match(/<h3>([^<]+)<\/h3>/)?.[1];
      assert.ok(title && !seenTitles.has(title), `${slug}: duplicate or empty title ${title}`);
      seenTitles.add(title);
    }

    assert.match(html, /Notă privind estimările nutriționale/);
    assert.match(html, /Când merită să discuți cu un nutriționist/);
    assert.match(html, /Ideea de reținut/);
  }

  assert.equal(totalBlocks, 30);
  assert.equal(seenTitles.size, 30);
});

test("all thirty nutrition estimates follow the documented calculation and rounding method", async () => {
  const audit = JSON.parse(await readFile(new URL("content/alimentatie/recipe-nutrition-audit.json", projectRoot), "utf8"));
  assert.equal(audit.methodology.primarySource, "USDA FoodData Central");
  assert.match(audit.methodology.weightBasis, /crude|fierte|gătite/i);
  assert.match(audit.methodology.portionMethod, /împărțit/i);
  assert.equal(audit.recipes.length, 30);
  assert.equal(new Set(audit.recipes.map((item) => item.id)).size, 30);

  for (const item of audit.recipes) {
    assert.ok(item.servings >= 1);
    assert.ok(item.caloriesTotal > 0 && item.proteinTotal > 0);
    assert.equal(item.displayedCalories, Math.round(item.caloriesTotal / item.servings / 10) * 10, `${item.id}: kcal`);
    assert.equal(item.displayedProtein, Math.round(item.proteinTotal / item.servings), `${item.id}: protein`);
  }

  const renderedValues = [];
  for (const [category, slug] of recipeArticles) {
    const html = normalizeRenderedHtml(await (await request(`/alimentatie/${category}/${slug}`)).text());
    const calories = [...html.matchAll(/~(\d+) kcal \/ porție/g)].map((match) => Number(match[1]));
    const proteins = [...html.matchAll(/~(\d+) g \/ porție/g)].map((match) => Number(match[1]));
    assert.equal(calories.length, 10);
    assert.equal(proteins.length, 10);
    renderedValues.push(...calories.map((value, index) => ({ calories: value, protein: proteins[index] })));
  }

  assert.deepEqual(
    renderedValues,
    audit.recipes.map((item) => ({ calories: item.displayedCalories, protein: item.displayedProtein })),
  );
});

test("goal nutrition articles preserve the strict weight-objective editorial contract", async () => {
  const files = await Promise.all(goalNutritionArticles.map(async ([category, slug]) => ({
    slug,
    content: await readFile(new URL(`content/alimentatie/articles/${category}/${slug}.mdx`, projectRoot), "utf8"),
  })));
  const combined = files.map(({ content }) => content).join("\n");
  assert.match(combined, /deficit energetic/i);
  assert.match(combined, /restricție extremă/i);
  assert.match(combined, /surplus controlat/i);
  assert.match(combined, /lean bulk/i);
  assert.match(combined, /surplus agresiv/i);
  assert.match(combined, /dirty bulk/i);
  assert.match(combined, /greutate în plus nu înseamnă automat mușchi/i);
  assert.match(combined, /interval/i);
  assert.match(combined, /metabolismul s-a stricat/i);
  assert.doesNotMatch(combined, /Mifflin|Harris-Benedict|\bTDEE\b|\bBMR\b|detox recomandat/i);
});

test("lifestyle and original category routes remain public at application level", async () => {
  for (const path of ["/stil-de-viata", ...publicCategories.map((category) => `/stil-de-viata/${category}`)]) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.doesNotMatch(response.headers.get("location") ?? "", /contul-meu|auth/);
  }
});

test("nutrition landing and all six real category routes render", async () => {
  for (const path of ["/alimentatie", ...nutritionCategories.map((category) => `/alimentatie/${category}`)]) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
  }
});

test("nutrition basePath stays isolated from lifestyle routes", async () => {
  const nutritionLanding = normalizeRenderedHtml(await (await request("/alimentatie")).text());
  const lifestyleLanding = normalizeRenderedHtml(await (await request("/stil-de-viata")).text());
  assert.equal((nutritionLanding.match(/href="\/alimentatie\//g) ?? []).length, 6);
  assert.doesNotMatch(nutritionLanding, /href="\/stil-de-viata\/(?:bazele|alimentatia|retete|restrictii|calculator)/);
  assert.doesNotMatch(lifestyleLanding, /href="\/alimentatie\/(?:somnul|stresul|munca|recuperarea|antrenamentul|mobilitate)/);
});

test("all nineteen nutrition articles render the complete editorial UI and SEO", async () => {
  for (const [category, slug] of nutritionArticles) {
    const path = `/alimentatie/${category}/${slug}`;
    const response = await request(path);
    assert.equal(response.status, 200, path);
    const html = normalizeRenderedHtml(await response.text());
    const takeaways = html.match(/<aside class="editorial-takeaways"[\s\S]*?<\/aside>/)?.[0] ?? "";
    const sources = html.match(/<details class="editorial-sources"[\s\S]*?<\/details>/)?.[0] ?? "";
    const related = html.match(/<section class="editorial-related"[\s\S]*?<\/section>/)?.[0] ?? "";
    assert.equal((takeaways.match(/<li>/g) ?? []).length, 3, `${slug}: takeaways`);
    const sourceCount = (sources.match(/<li>/g) ?? []).length;
    assert.ok(sourceCount >= 3 && sourceCount <= 5, `${slug}: ${sourceCount} sources`);
    assert.equal((related.match(/editorial-article-card compact/g) ?? []).length, 2, `${slug}: recommendations`);
    assert.match(html, /Când merită să discuți cu un (?:medic sau )?nutriționist/);
    assert.match(html, /Ideea de reținut/);
    assert.match(html, /editorial-article-navigation/);
    assert.match(html, new RegExp(`rel="canonical" href="https://example\\.test${path}"`));
    assert.match(html, new RegExp(`property="og:url" content="https://example\\.test${path}"`));
    assert.doesNotMatch(html, /name="robots" content="noindex/);
  }
});

test("nutrition previous and next navigation stays within each ordered category chain", async () => {
  for (const categoryArticles of [foundationArticles, dailyNutritionArticles, goalNutritionArticles, recipeArticles, restrictionArticles]) {
    for (let index = 0; index < categoryArticles.length; index += 1) {
      const [category, slug] = categoryArticles[index];
      const html = normalizeRenderedHtml(await (await request(`/alimentatie/${category}/${slug}`)).text());
      const navigation = html.match(/<nav class="editorial-article-navigation"[\s\S]*?<\/nav>/)?.[0] ?? "";
      const previous = categoryArticles[index - 1]?.[1];
      const next = categoryArticles[index + 1]?.[1];
      if (previous) assert.match(navigation, new RegExp(`/alimentatie/${category}/${previous}`));
      else assert.doesNotMatch(navigation, /←/);
      if (next) assert.match(navigation, new RegExp(`/alimentatie/${category}/${next}`));
      else assert.doesNotMatch(navigation, /cta-arrow/);
    }
  }
});

test("every internal nutrition link resolves without 404", async () => {
  const pages = [
    "/alimentatie",
    ...nutritionCategories.map((category) => `/alimentatie/${category}`),
    ...nutritionArticles.map(([category, slug]) => `/alimentatie/${category}/${slug}`),
  ];
  const discovered = new Set();

  for (const page of pages) {
    const response = await request(page);
    const html = await response.text();
    for (const match of html.matchAll(/href="(\/alimentatie[^"#?]*)"/g)) discovered.add(match[1]);
  }

  assert.deepEqual([...discovered].sort(), pages.sort());
  for (const path of discovered) assert.equal((await request(path)).status, 200, path);
});

test("foundation category exposes exactly four ordered article cards", async () => {
  const response = await request("/alimentatie/bazele-alimentatiei");
  const html = normalizeRenderedHtml(await response.text());
  assert.equal(response.status, 200);
  assert.match(html, />4 articole</);
  const links = [...html.matchAll(/href="(\/alimentatie\/bazele-alimentatiei\/[^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(links, foundationArticles.map(([category, slug]) => `/alimentatie/${category}/${slug}`));
});

test("daily nutrition category exposes exactly four ordered article cards", async () => {
  const response = await request("/alimentatie/alimentatia-de-zi-cu-zi");
  const html = normalizeRenderedHtml(await response.text());
  assert.equal(response.status, 200);
  assert.match(html, />4 articole</);
  assert.doesNotMatch(html, /În pregătire/);
  const links = [...html.matchAll(/href="(\/alimentatie\/alimentatia-de-zi-cu-zi\/[^\"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(links, dailyNutritionArticles.map(([category, slug]) => `/alimentatie/${category}/${slug}`));
});

test("goal nutrition category exposes exactly four ordered article cards", async () => {
  const response = await request("/alimentatie/alimentatia-pentru-obiectiv");
  const html = normalizeRenderedHtml(await response.text());
  assert.equal(response.status, 200);
  assert.match(html, />4 articole</);
  assert.doesNotMatch(html, /În pregătire/);
  const links = [...html.matchAll(/href="(\/alimentatie\/alimentatia-pentru-obiectiv\/[^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(links, goalNutritionArticles.map(([category, slug]) => `/alimentatie/${category}/${slug}`));
});

test("simple recipes category exposes exactly three ordered published article cards", async () => {
  const response = await request("/alimentatie/retete-simple");
  const html = normalizeRenderedHtml(await response.text());
  assert.equal(response.status, 200);
  assert.match(html, />3 articole</);
  assert.doesNotMatch(html, /În pregătire/);
  const links = [...html.matchAll(/href="(\/alimentatie\/retete-simple\/[^\"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(links, recipeArticles.map(([category, slug]) => `/alimentatie/${category}/${slug}`));
});

test("restrictions expose exactly four ordered articles while the calorie calculator stays separate", async () => {
  const restrictions = normalizeRenderedHtml(await (await request("/alimentatie/restrictii-si-intolerante")).text());
  assert.match(restrictions, />4 articole</);
  assert.doesNotMatch(restrictions, /În pregătire/);
  const links = [...restrictions.matchAll(/href="(\/alimentatie\/restrictii-si-intolerante\/[^\"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(links, restrictionArticles.map(([category, slug]) => `/alimentatie/${category}/${slug}`));
});

test("restriction articles pass the dedicated medical and editorial safety gate", async () => {
  const files = await Promise.all(restrictionArticles.map(async ([category, slug]) => ({
    slug,
    content: await readFile(new URL(`content/alimentatie/articles/${category}/${slug}.mdx`, projectRoot), "utf8"),
  })));
  const combined = files.map(({ content }) => content).join("\n");
  assert.match(combined, /intoleranța la lactoză nu este alergie la lapte/i);
  assert.match(combined, /boala celiacă.*alergia la grâu.*nu (?:sunt|este) același lucru/is);
  assert.match(combined, /fără gluten nu înseamnă automat mai sănătos/i);
  assert.match(combined, /112/);
  assert.match(combined, /14 categorii/);
  assert.match(combined, /nu oferă dozaje/i);
  assert.match(combined, /nu.*autodiagnostic/i);
  assert.doesNotMatch(combined, /ai balonare[^.]{0,80}ai intoleranță|te simți mai bine fără gluten[^.]{0,80}boală celiacă/i);
  assert.doesNotMatch(combined, /glutenul (?:este|e) rău pentru toată lumea|fără gluten (?:este|e) mai sănătos|carență garantată|detox|toxine/i);
  assert.doesNotMatch(combined, /\b(?:mg|mcg|µg)\b|doză zilnică|protocol de tratament/i);
});

test("nutrition recommendations resolve to two published articles in the same category", async () => {
  for (const [category, slug] of nutritionArticles) {
    const html = normalizeRenderedHtml(await (await request(`/alimentatie/${category}/${slug}`)).text());
    const related = html.match(/<section class="editorial-related"[\s\S]*?<\/section>/)?.[0] ?? "";
    const links = [...related.matchAll(/href="(\/alimentatie\/[^\"]+)"/g)].map((match) => match[1]);
    assert.equal(links.length, 2, `${slug}: recommendations`);
    for (const link of links) {
      assert.match(link, new RegExp(`^/alimentatie/${category}/`), `${slug}: cross-category recommendation`);
      assert.equal((await request(link)).status, 200, link);
    }
  }
});

test("RecipeBlock remains static and adds no client state, fetches or media", async () => {
  const component = await readFile(new URL("components/editorial/recipe-block.tsx", projectRoot), "utf8");
  const recipes = await readFile(new URL("content/alimentatie/recipes.ts", projectRoot), "utf8");
  assert.doesNotMatch(component, /["']use client["']/);
  assert.doesNotMatch(component, /useState|useEffect|fetch\(|XMLHttpRequest|<img|<video/);
  assert.equal((recipes.match(/^\s{4}number: \d+,/gm) ?? []).length, 30);
  assert.equal((recipes.match(/^\s{4}ingredients: \[/gm) ?? []).length, 30);
  assert.equal((recipes.match(/^\s{4}preparation: \[/gm) ?? []).length, 30);
});

test("calculator is functional and indexable after the final release gate", async () => {
  const response = await request("/alimentatie/calculator-caloric");
  const html = normalizeRenderedHtml(await response.text());
  assert.equal(response.status, 200);
  assert.match(html, /<form class="calorie-calculator-form"/);
  assert.match(html, /Mifflin–St Jeor/);
  assert.match(html, /Estimează necesarul caloric/);
  assert.doesNotMatch(html, /name="robots" content="noindex/);
  assert.match(html, /rel="canonical" href="https:\/\/example\.test\/alimentatie\/calculator-caloric"/);
  assert.match(html, /property="og:url" content="https:\/\/example\.test\/alimentatie\/calculator-caloric"/);
  assert.doesNotMatch(html, /Calculator caloric — în pregătire|Funcționalitate în pregătire/);
});

test("all 16 public article routes render without authentication and expose sources without a visible counter", async () => {
  for (const [category, slug] of publicArticles) {
    const path = `/stil-de-viata/${category}/${slug}`;
    const response = await request(path);
    assert.equal(response.status, 200, path);
    const html = normalizeRenderedHtml(await response.text());
    assert.match(html, /<details class="editorial-sources"/);
    assert.match(html, /<summary>/);
    assert.match(html, /rel="noopener noreferrer"/);
    const sourceSection = html.match(/<details class="editorial-sources"[\s\S]*?<\/details>/)?.[0] ?? "";
    const sourceCount = (sourceSection.match(/<li>/g) ?? []).length;
    assert.ok(sourceCount >= 3 && sourceCount <= 5, `${slug}: ${sourceCount} sources`);
    assert.match(sourceSection, /<summary><span>Surse<\/span>/);
    assert.doesNotMatch(sourceSection, /documente verificate|Surse\s*[—(]\s*\d|\d+\s+surse/i);
    assert.match(html, new RegExp(`rel="canonical" href="https://example\\.test${path}"`));
  }
});

test("each public category exposes exactly four fully clickable article cards", async () => {
  for (const category of publicCategories) {
    const response = await request(`/stil-de-viata/${category}`);
    const html = normalizeRenderedHtml(await response.text());
    const links = html.match(new RegExp(`href="/stil-de-viata/${category}/[^\"]+"`, "g")) ?? [];
    assert.equal(links.length, 4, category);
    assert.match(html, />4 articole</);
    assert.doesNotMatch(html, /În curând|editorial-article-card draft/);
  }
});

test("subscription categories and their articles are denied without a VEMI session", async () => {
  for (const category of subscriptionCategories) {
    const response = await request(`/stil-de-viata/${category}`);
    assert.equal(response.status, 404, category);
  }

  for (const [category, slug] of subscriptionArticles) {
    const response = await request(`/stil-de-viata/${category}/${slug}`);
    assert.equal(response.status, 404, `${category}/${slug}`);
  }
});

test("subscription categories stay visible on the main page without becoming links", async () => {
  const response = await request("/stil-de-viata");
  const html = normalizeRenderedHtml(await response.text());
  assert.equal(response.status, 200);
  assert.match(html, /Antrenamentul/);
  assert.match(html, /Mobilitate și prevenție/);
  assert.match(html, /lifestyle-subscription-lock/);
  assert.match(html, /aria-label="Necesită abonament"/);
  assert.match(html, /lifestyle-card-cta[\s\S]*cta-arrow/);
  assert.doesNotMatch(html, /lifestyle-subscription-label|>Inclus în toate abonamentele</);
  assert.doesNotMatch(html, /href="\/stil-de-viata\/antrenamentul"/);
  assert.doesNotMatch(html, /href="\/stil-de-viata\/mobilitate-si-preventie"/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /aria-haspopup="dialog"|role="dialog"|lifestyle-access-backdrop/);
});

test("editorial CTA arrows use the shared desktop treatment", async () => {
  const response = await request("/stil-de-viata/somnul");
  const html = normalizeRenderedHtml(await response.text());
  assert.equal(response.status, 200);
  assert.match(html, /editorial-article-cta[\s\S]*cta-arrow/);

  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /@media \(min-width: 981px\)[\s\S]*\.cta-arrow/);
});

test("lifestyle hero is compact only on desktop without changing its title size", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const desktopRules = css.slice(css.indexOf("@media (min-width: 981px)"));

  assert.match(desktopRules, /\.lifestyle-hero\s*\{\s*min-height:\s*380px;\s*padding-top:\s*40px;\s*padding-bottom:\s*56px;/);
  assert.match(desktopRules, /\.lifestyle-hero h1\s*\{\s*font-size:\s*clamp\(54px, 5\.7vw, 86px\);\s*\}/);

  const mobileRules = css.slice(css.indexOf("@media (max-width: 720px)"), css.indexOf("@media (max-width: 600px)"));
  assert.match(mobileRules, /\.lifestyle-hero\s*\{\s*min-height:\s*auto;\s*padding:\s*46px 20px 44px;/);
});

test("lifestyle landing is reached directly without the legacy gateway", async () => {
  const page = await readFile(new URL("../app/stil-de-viata/page.tsx", import.meta.url), "utf8");
  const drawer = await readFile(new URL("../components/vemi-navigation-drawer.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(drawer, /\{ href: "\/stil-de-viata", label: "Stil de viață", icon: "leaf" \}/);
  assert.match(drawer, /navigateFromDrawer\(href\);/);
  assert.match(drawer, /window\.location\.assign\(href\);/);
  assert.doesNotMatch(drawer, /LifestyleDrawer|openLifestyle|data-lifestyle|vemi-lifestyle-secondary-root/);
  assert.doesNotMatch(page, /LifestyleGateway|lifestyle-gateway|lifestyle-secondary/);
  assert.doesNotMatch(css, /lifestyle-gateway|lifestyle-secondary|data-lifestyle/);
});

test("editorial responsive contract covers every required validation width", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const widths = [320, 360, 390, 430, 720, 980, 1280];
  const mobileRules = css.slice(css.indexOf("@media (max-width: 720px)"), css.indexOf("@media (max-width: 600px)"));
  const tabletRules = css.slice(css.indexOf("@media (max-width: 980px)"), css.indexOf("@media (max-width: 720px)"));

  for (const width of widths) {
    if (width <= 720) {
      assert.match(mobileRules, /\.lifestyle-category-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
      assert.match(mobileRules, /\.editorial-article-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
      assert.match(mobileRules, /\.editorial-sources li\s*\{\s*grid-template-columns:\s*1fr/);
      assert.match(mobileRules, /\.editorial-article-navigation\s*\{\s*grid-template-columns:\s*1fr/);
      assert.match(mobileRules, /nutrition-goal[^}]*h1[\s\S]*nutrition-restrictions[^}]*h1/);
    } else if (width <= 980) {
      assert.match(tabletRules, /\.editorial-desktop-nav\s*\{\s*display:\s*none/);
      assert.match(tabletRules, /\.editorial-mobile-menu\s*\{\s*display:\s*block/);
    }
  }

  assert.match(css, /\.editorial-mobile-menu > summary\s*\{\s*width:\s*44px;\s*height:\s*44px/);
  assert.doesNotMatch(css, /nutrition-(?:goal|restrictions)[^}]*white-space:\s*nowrap/);
  assert.match(css, /\.calorie-calculator-shell[^}]*width:\s*min\(980px, calc\(100% - 40px\)\)/);
  assert.match(mobileRules, /\.recipe-block-facts\s*\{\s*grid-template-columns:\s*1fr 1fr/);
  assert.match(mobileRules, /\.recipe-block-content\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(css, /\.recipe-block\s*\{[^}]*overflow-wrap:\s*anywhere/);
});

test("unknown category and article combinations remain 404", async () => {
  for (const path of [
    "/stil-de-viata/categorie-inexistenta",
    "/stil-de-viata/somnul/articol-inexistent",
    "/stil-de-viata/stresul/de-ce-este-somnul-esential",
    "/alimentatie/categorie-inexistenta",
    "/alimentatie/bazele-alimentatiei/articol-inexistent",
    "/alimentatie/alimentatia-de-zi-cu-zi/caloriile-ce-sunt-si-de-ce-conteaza",
  ]) {
    const response = await request(path);
    assert.equal(response.status, 404, path);
  }
});

test("sitemap includes public editorial routes and excludes subscription routes", async () => {
  const response = await request("/sitemap.xml");
  const sitemap = await response.text();
  assert.equal(response.status, 200);
  for (const category of publicCategories) assert.match(sitemap, new RegExp(`/stil-de-viata/${category}<`));
  for (const [category, slug] of publicArticles) assert.match(sitemap, new RegExp(`/${category}/${slug}<`));
  for (const category of subscriptionCategories) assert.doesNotMatch(sitemap, new RegExp(`/stil-de-viata/${category}`));
  assert.match(sitemap, /\/alimentatie</);
  for (const category of nutritionCategories) {
    assert.match(sitemap, new RegExp(`/alimentatie/${category}<`));
  }
  for (const [category, slug] of nutritionArticles) assert.match(sitemap, new RegExp(`/alimentatie/${category}/${slug}<`));
  assert.equal((sitemap.match(/\/alimentatie\/calculator-caloric/g) ?? []).length, 1);
});

test("recommended article resolution uses category-scoped keys", async () => {
  const helper = await readFile(new URL("lib/editorial/catalog.ts", projectRoot), "utf8");
  assert.match(helper, /`\$\{article\.categorySlug\}\/\$\{article\.slug\}`/);
  assert.match(helper, /`\$\{currentArticle\.categorySlug\}\/\$\{slug\}`/);
  assert.doesNotMatch(helper, /find\(\(item\) => item\.slug === slug\)/);
});

test("subscription storage is RLS protected and entitlement checks stay server-side", async () => {
  const migration = await readFile(new URL("supabase/migrations/202608050001_vemi_user_subscriptions.sql", projectRoot), "utf8");
  const helper = await readFile(new URL("utils/subscriptions/server.ts", projectRoot), "utf8");
  const premiumCard = await readFile(new URL("components/editorial/subscription-category-card.tsx", projectRoot), "utf8");

  assert.match(migration, /enable row level security/i);
  assert.match(migration, /force row level security/i);
  assert.match(migration, /using \(user_id = auth\.uid\(\)\)/);
  assert.match(migration, /revoke all on table public\.user_subscriptions from authenticated/i);
  assert.doesNotMatch(migration, /for (insert|update|delete)\s+to authenticated/i);
  assert.match(helper, /\.eq\("status", "active"\)/);
  assert.match(helper, /\.lte\("starts_at", now\)/);
  assert.match(helper, /\.gt\("expires_at", now\)/);
  assert.doesNotMatch(helper, /localStorage|sessionStorage/);
  assert.doesNotMatch(premiumCard, /localStorage|sessionStorage|URLSearchParams/);
});

test("editorial identity, navigation and server-first rendering stay clean", async () => {
  const editorialFiles = await Promise.all([
    "app/stil-de-viata/page.tsx",
    "app/stil-de-viata/[categorySlug]/page.tsx",
    "app/stil-de-viata/[categorySlug]/[articleSlug]/page.tsx",
    "app/stil-de-viata/not-found.tsx",
    "components/editorial/category-card.tsx",
    "components/editorial/article-card.tsx",
  ].map((path) => readFile(new URL(path, projectRoot), "utf8")));

  editorialFiles.forEach((content) => {
    assert.doesNotMatch(content, /["']use client["']/);
    assert.doesNotMatch(content, /Biblioteca VEMI|articol-pilot|În curând|în pregătire/);
  });

  const home = await readFile(new URL("components/vemi-page.tsx", projectRoot), "utf8");
  const account = await readFile(new URL("app/contul-meu/account-client.tsx", projectRoot), "utf8");
  assert.match(home, /href="\/stil-de-viata"/);
  assert.match(account, /href="\/stil-de-viata"/);
  assert.match(home, /href="\/alimentatie"/);
  assert.match(account, /href="\/alimentatie"/);
});
