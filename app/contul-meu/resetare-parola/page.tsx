import { redirect } from "next/navigation";
import { createClient } from "../../../utils/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ResetareParolaPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) redirect("/contul-meu?mesaj=link-invalid");

  return (
    <main className="account-page account-reset-page">
      <section className="account-main">
        <header className="account-intro">
          <p className="section-kicker">Contul tău VEMI</p>
          <h1>Alege o parolă<br />nouă.</h1>
          <p>Linkul este temporar. După salvare vei putea continua în același cont.</p>
        </header>
        <ResetPasswordForm />
      </section>
    </main>
  );
}
