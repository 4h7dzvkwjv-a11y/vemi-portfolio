"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";

export type AuthActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialAuthState: AuthActionState = { status: "idle", message: "" };

const genericAuthError = "Datele introduse nu sunt corecte. Verifică-le și încearcă din nou.";
const adminVideoPath = "/admin/exercitii-video";

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function siteOrigin() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";

  if (host) return `${protocol}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL!;
}

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = readText(formData, "email").toLowerCase();
  const password = readText(formData, "password");
  const returnTo = readText(formData, "returnTo") === adminVideoPath ? adminVideoPath : "/contul-meu";

  if (!email || !password) return { status: "error", message: genericAuthError };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { status: "error", message: genericAuthError };

  redirect(returnTo);
}

export async function signUpAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const username = readText(formData, "username").toLowerCase();
  const email = readText(formData, "email").toLowerCase();
  const password = readText(formData, "password");

  if (!/^[a-z0-9._-]{3,30}$/.test(username) || !email.includes("@") || password.length < 8) {
    return {
      status: "error",
      message: "Folosește un username de 3–30 de caractere și o parolă de cel puțin 8 caractere.",
    };
  }

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${origin}/auth/callback?next=/contul-meu`,
    },
  });

  if (error) return { status: "error", message: genericAuthError };

  return {
    status: "success",
    message: "Verifică e-mailul pentru a confirma contul. Dacă adresa poate fi folosită, vei primi instrucțiunile în scurt timp.",
  };
}

export async function requestPasswordResetAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = readText(formData, "email").toLowerCase();

  if (email.includes("@")) {
    const supabase = await createClient();
    const origin = await siteOrigin();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/contul-meu/resetare-parola`,
    });
  }

  return {
    status: "success",
    message: "Dacă adresa aparține unui cont, vei primi un link temporar pentru resetarea parolei.",
  };
}

export async function updatePasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = readText(formData, "password");
  const confirmation = readText(formData, "passwordConfirmation");

  if (password.length < 8 || password !== confirmation) {
    return {
      status: "error",
      message: "Parolele trebuie să coincidă și să aibă cel puțin 8 caractere.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { status: "error", message: "Linkul nu mai este valid. Solicită unul nou." };

  return { status: "success", message: "Parola a fost actualizată. Poți continua în contul tău." };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/contul-meu");
}
