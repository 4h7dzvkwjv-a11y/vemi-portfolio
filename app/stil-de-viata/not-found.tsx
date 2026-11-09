import Link from "next/link";

export default function LifestyleNotFound() {
  return (
    <main className="editorial-not-found">
      <p className="section-kicker">Stil de viață</p>
      <h1>Pagina nu a fost găsită.</h1>
      <p>Adresa nu este corectă sau pagina nu există.</p>
      <Link className="button primary" href="/stil-de-viata">Înapoi la Stil de viață</Link>
    </main>
  );
}
