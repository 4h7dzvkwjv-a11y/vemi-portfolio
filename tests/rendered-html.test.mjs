import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_test";

  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, developmentPreviewMeta);
  assert.match(
    html,
    /<meta(?=[^>]*\bname=["']vemi-supabase-url["'])(?=[^>]*\bcontent=["']https:\/\/example\.supabase\.co["'])[^>]*>/i,
  );
  assert.match(
    html,
    /<meta(?=[^>]*\bname=["']vemi-supabase-publishable-key["'])(?=[^>]*\bcontent=["']sb_publishable_test["'])[^>]*>/i,
  );

  const clientAssetsUrl = new URL("../dist/client/assets/", import.meta.url);
  const assetNames = await readdir(clientAssetsUrl);
  const clientJavascript = await Promise.all(
    assetNames
      .filter((name) => name.endsWith(".js"))
      .map((name) => readFile(new URL(name, clientAssetsUrl), "utf8")),
  );
  const supabaseClientBundle = clientJavascript.find((source) =>
    source.includes('meta[name="vemi-supabase-url"]'),
  );
  assert.ok(supabaseClientBundle, "browser Supabase configuration is bundled");
  assert.doesNotMatch(supabaseClientBundle, /NEXT_PUBLIC_SUPABASE_(?:URL|PUBLISHABLE_KEY)/);
});
