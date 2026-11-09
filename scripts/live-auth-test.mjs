import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const phase = process.argv[2];
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const accounts = ["A", "B"].map((label) => ({
  label,
  email: process.env[`VEMI_TEST_EMAIL_${label}`],
  password: process.env[`VEMI_TEST_PASSWORD_${label}`],
  username: process.env[`VEMI_TEST_USERNAME_${label}`],
}));

if (!supabaseUrl || !publishableKey) throw new Error("Lipsesc variabilele publice Supabase.");
if (!accounts.every(({ email, password, username }) => email && password && username)) {
  throw new Error("Sunt necesare două adrese reale, două parole și două username-uri de test.");
}
if (new Set(accounts.map(({ email }) => email.toLowerCase())).size !== 2) {
  throw new Error("Conturile trebuie să folosească două adrese de e-mail diferite.");
}
if (new Set(accounts.map(({ username }) => username.toLowerCase())).size !== 2) {
  throw new Error("Conturile trebuie să folosească două username-uri diferite.");
}

const makeClient = () => createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

if (phase === "signup") {
  for (const account of accounts) {
    const client = makeClient();
    const { data, error } = await client.auth.signUp({
      email: account.email,
      password: account.password,
      options: { data: { username: account.username } },
    });
    if (error) throw new Error(`Crearea contului ${account.label} a eșuat: ${error.message}`);
    assert.ok(data.user, `Contul ${account.label} nu a returnat un utilizator.`);
    console.log(`Contul ${account.label}: solicitarea de creare a fost acceptată; confirmă e-mailul.`);
  }
} else if (phase === "verify") {
  const sessions = [];

  for (const account of accounts) {
    const client = makeClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (error || !data.user) throw new Error(`Loginul contului ${account.label} a eșuat după confirmare.`);

    const [{ data: profiles, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
      client.from("profiles").select("id,username"),
      client.from("user_roles").select("user_id,role"),
    ]);

    assert.ifError(profileError);
    assert.ifError(roleError);
    assert.equal(profiles.length, 1, `Contul ${account.label} trebuie să vadă exact propriul profil.`);
    assert.equal(roles.length, 1, `Contul ${account.label} trebuie să vadă exact propriul rol.`);
    assert.equal(profiles[0].id, data.user.id);
    assert.equal(profiles[0].username, account.username.toLowerCase());
    assert.equal(roles[0].user_id, data.user.id);
    assert.equal(roles[0].role, "user");

    const { error: writeError } = await client
      .from("user_roles")
      .update({ role: "admin" })
      .eq("user_id", data.user.id);
    assert.ok(writeError, "Un utilizator obișnuit nu trebuie să își poată schimba rolul.");

    sessions.push({ client, userId: data.user.id, label: account.label });
  }

  for (let index = 0; index < sessions.length; index += 1) {
    const current = sessions[index];
    const other = sessions[1 - index];
    const { data, error } = await current.client.from("profiles").select("id").eq("id", other.userId);
    assert.ifError(error);
    assert.equal(data.length, 0, `Contul ${current.label} nu trebuie să vadă profilul ${other.label}.`);
    await current.client.auth.signOut();
  }

  console.log("Verificare reușită: login, profil, rol, RLS între utilizatori și logout.");
} else {
  throw new Error("Folosește faza signup sau verify.");
}
