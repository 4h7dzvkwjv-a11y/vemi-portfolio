import Link from "next/link";

export default function NutritionNotFound() {
  return (
    <main className="editorial-not-found">
      <p className="section-kicker">Pagina nu a fost găsită</p>
      <h1>Materialul căutat nu este disponibil.</h1>
      <p>Verifică adresa sau revino la secțiunea Alimentație.</p>
      <Link className="button primary" href="/alimentatie">Înapoi la Alimentație</Link>
    </main>
  );
}
