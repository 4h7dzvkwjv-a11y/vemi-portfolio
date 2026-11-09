const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Lipsesc variabilele publice Supabase.");
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function inspectTable(table) {
  const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers });
  const body = await response.text();

  if (response.status === 404 || /PGRST205|relation .* does not exist/i.test(body)) {
    throw new Error(`Tabela ${table} nu este disponibilă prin API.`);
  }

  if (![200, 401, 403].includes(response.status)) {
    throw new Error(`Răspuns neașteptat pentru ${table}: HTTP ${response.status}.`);
  }

  return { table, status: response.status, anonymousAccessBlocked: response.status !== 200 };
}

const settingsResponse = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
if (!settingsResponse.ok) throw new Error(`Auth settings indisponibile: HTTP ${settingsResponse.status}.`);
const settings = await settingsResponse.json();

const tables = await Promise.all([
  inspectTable("profiles"),
  inspectTable("user_roles"),
  inspectTable("exercises"),
  inspectTable("exercise_aliases"),
  inspectTable("user_subscriptions"),
]);

console.log(JSON.stringify({
  authEndpoint: "ok",
  emailProviderEnabled: settings.external?.email === true,
  tables,
}, null, 2));
