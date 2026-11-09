import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("folosește Supabase SSR cu cookies, fără service role", async () => {
  const [server, proxy, browser, cookieOptions, pkg] = await Promise.all([
    read("utils/supabase/server.ts"),
    read("utils/supabase/proxy.ts"),
    read("utils/supabase/client.ts"),
    read("utils/supabase/cookie-options.ts"),
    read("package.json"),
  ]);

  assert.match(server, /createServerClient/);
  assert.match(server, /cookies\(\)/);
  assert.match(proxy, /auth\.getClaims\(\)/);
  assert.match(`${server}\n${proxy}\n${browser}`, /cookieOptions: supabaseCookieOptions/);
  assert.match(cookieOptions, /path: "\/"/);
  assert.match(cookieOptions, /sameSite: "lax"/);
  assert.match(cookieOptions, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(cookieOptions, /httpOnly: false/);
  assert.doesNotMatch(`${server}\n${proxy}\n${browser}`, /service[_-]?role|SUPABASE_SECRET/i);
  assert.match(pkg, /"@supabase\/ssr"/);
});

test("acțiunile folosesc auth real și răspuns generic la resetare", async () => {
  const actions = await read("app/contul-meu/actions.ts");

  assert.match(actions, /signUp\(/);
  assert.match(actions, /signInWithPassword\(/);
  assert.match(actions, /resetPasswordForEmail\(/);
  assert.match(actions, /updateUser\(\{ password \}\)/);
  assert.match(actions, /Dacă adresa aparține unui cont/);
  assert.doesNotMatch(actions, /localStorage/);
});

test("callback-ul PKCE permite doar redirecturi interne", async () => {
  const callback = await read("app/auth/callback/route.ts");

  assert.match(callback, /exchangeCodeForSession/);
  assert.match(callback, /startsWith\("\/"\)/);
  assert.match(callback, /!value\.startsWith\("\/\/"\)/);
  assert.match(callback, /force-dynamic/);
});

test("migrarea activează RLS și separă rolurile", async () => {
  const migration = await read("supabase/migrations/202608040001_vemi_auth_profiles.sql");

  assert.match(migration, /alter table public\.profiles enable row level security/);
  assert.match(migration, /alter table public\.user_roles enable row level security/);
  assert.match(migration, /profiles_select_own_or_admin/);
  assert.match(migration, /roles_select_own_or_admin/);
  assert.match(migration, /revoke insert, update, delete on table public\.user_roles from authenticated/);
  assert.match(migration, /values \(new\.id, 'user'\)/);
});
