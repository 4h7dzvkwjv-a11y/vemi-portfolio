import type { Metadata } from "next";
import Link from "next/link";
import { ArticleCard } from "@/components/editorial/article-card";
import { CalorieCalculator } from "@/components/editorial/calorie-calculator";
import { getNutritionArticle, getNutritionCategory } from "@/content/alimentatie/catalog";
import { createEditorialMetadata } from "@/lib/editorial/seo";

const metadataBase = createEditorialMetadata({
  title: "Calculator caloric",
  description: "Estimează orientativ necesarul caloric pentru menținere, slăbire sau creștere în greutate, local și fără salvarea datelor.",
  path: "/alimentatie/calculator-caloric",
});

export const metadata: Metadata = metadataBase;

const sources = [
  { institution: "Mifflin MD și colaboratorii", title: "A new predictive equation for resting energy expenditure in healthy individuals", context: "Studiul original al ecuației Mifflin–St Jeor", url: "https://pubmed.ncbi.nlm.nih.gov/2305711/" },
  { institution: "Frankenfield D și colaboratorii", title: "Comparison of predictive equations for resting metabolic rate in healthy nonobese and obese adults", context: "Review comparativ al ecuațiilor predictive", url: "https://pubmed.ncbi.nlm.nih.gov/15883556/" },
  { institution: "Autoritatea Europeană pentru Siguranța Alimentară", title: "Dietary Reference Values for energy", context: "Factori PAL și necesarul energetic la adulți", url: "https://www.efsa.europa.eu/en/efsajournal/pub/3005" },
  { institution: "FAO / WHO / UNU", title: "Human energy requirements — adults", context: "Metodologia activității fizice pe o săptămână obișnuită", url: "https://www.fao.org/4/y5686e/y5686e07.htm" },
  { institution: "NICE", title: "Overweight and obesity management — physical activity and diet", context: "Context clinic pentru dietele low-energy", url: "https://www.nice.org.uk/guidance/ng246/chapter/Physical-activity-and-diet" },
  { institution: "Helms E și colaboratorii", title: "Effect of Small and Large Energy Surpluses on Strength, Muscle, and Skinfold Thickness", context: "Surplusuri energetice și adaptări la antrenamentul de forță", url: "https://link.springer.com/article/10.1186/s40798-023-00651-y" },
] as const;

export default function CalorieCalculatorPage() {
  const category = getNutritionCategory("calculator-caloric")!;
  const recommendations = [
    getNutritionArticle("bazele-alimentatiei", "caloriile-ce-sunt-si-de-ce-conteaza"),
    getNutritionArticle("alimentatia-pentru-obiectiv", "mentinerea-greutatii-si-a-formei"),
  ].filter((article): article is NonNullable<typeof article> => Boolean(article));

  return (
    <main className="lifestyle-category-page calorie-calculator-page">
      <section className="lifestyle-category-hero">
        <nav className="editorial-breadcrumb" aria-label="Fir de navigare">
          <ol>
            <li><Link href="/">Acasă</Link></li>
            <li><Link href="/alimentatie">Alimentație</Link></li>
            <li aria-current="page">Calculator caloric</li>
          </ol>
        </nav>
        <div className={`lifestyle-category-symbol ${category.visual}`} aria-hidden="true"><i /><b /></div>
        <p className="section-kicker">Estimare orientativă</p>
        <h1>Calculator caloric</h1>
        <p>Estimează un interval caloric pentru obiectivul tău. Calculul se face local, fără cont și fără salvarea valorilor.</p>
        <span>Instrument disponibil</span>
      </section>

      <section className="calorie-page-intro" aria-labelledby="calorie-intro-title">
        <p className="section-kicker">Înainte să începi</p>
        <h2 id="calorie-intro-title">O estimare pentru adulți sănătoși, nu o prescripție.</h2>
        <p>Calculatorul folosește date din anvelopa lotului original Mifflin–St Jeor: 19–78 ani, 46–143 kg și 146–201 cm. Aceste limite descriu domeniul în care alegem să nu extrapolăm formula; nu sunt definiții ale unei greutăți, înălțimi sau vârste „sănătoase”.</p>
        <aside className="calorie-safety-note">
          <strong>Când rezultatul nu trebuie folosit singur</strong>
          <p>Calculatorul este destinat adulților sănătoși. Nu folosi rezultatul ca țintă fără evaluare profesională dacă ești însărcinată sau alăptezi, ai o afecțiune ori urmezi un tratament care îți poate modifica necesarul energetic, ai istoric sau suspiciune de tulburare de alimentație ori ai avut variații semnificative neintenționate de greutate.</p>
        </aside>
      </section>

      <CalorieCalculator />

      <article className="calorie-editorial-content">
        <section aria-labelledby="calorie-method-title">
          <p className="section-kicker">Metodă transparentă</p>
          <h2 id="calorie-method-title">Cum este estimat necesarul</h2>
          <p>Mai întâi, ecuația Mifflin–St Jeor estimează metabolismul de repaus (RMR): energia pe care organismul o folosește în repaus. Ecuația publicată are două ramuri biologice și folosește greutatea, înălțimea și vârsta. RMR nu este prezentat drept aport zilnic și nu este rotunjit în calculele interne.</p>
          <p>Estimarea centrală de menținere rezultă din înmulțirea RMR cu un factor PAL de 1,4, 1,6, 1,8 sau 2,0. PAL descrie întreaga activitate a unei săptămâni obișnuite — muncă, mers, activități cotidiene și antrenamente — nu numai numărul ședințelor de sală. Apoi se aplică intervalul obiectivului, iar fiecare capăt final este rotunjit la cel mai apropiat multiplu de 50 kcal.</p>
        </section>

        <section aria-labelledby="calorie-result-meaning-title">
          <h2 id="calorie-result-meaning-title">Ce înseamnă rezultatul</h2>
          <p>Pentru menținere, intervalul reprezintă 90–110% din estimarea centrală. Pentru slăbire, intervalul orientativ este 80–90%, iar pentru creștere în greutate și susținerea antrenamentului de forță este 105–110%. Aceste procente sunt repere de pornire, nu reguli obligatorii și nu prezic un anumit număr de kilograme pe săptămână.</p>
          <p>O ecuație predictivă nu măsoară metabolismul individual. Activitatea aleasă, compoziția corporală, adaptările organismului și diferențele dintre persoane pot deplasa necesarul real. Poți folosi mijlocul intervalului ca reper inițial și urmări tendința pe parcursul a două până la patru săptămâni, apoi ajusta treptat în funcție de evoluția observată.</p>
        </section>

        <section aria-labelledby="calorie-limits-title">
          <h2 id="calorie-limits-title">Limite și când merită ajutor profesional</h2>
          <p>Versiunea actuală nu calculează pentru valori aflate în afara anvelopei 19–78 ani, 46–143 kg și 146–201 cm. Nu oferă BMI, macronutrienți, plan alimentar sau recomandări medicale. Pentru calorimetrie, sport de performanță cu volum mare, recuperare după boală sau operație, afecțiuni endocrine, renale, hepatice, cardiace ori metabolice și medicație care influențează apetitul sau greutatea, discută cu un dietetician sau medic.</p>
          <p>Dacă limita inferioară brută pentru slăbire ar coborî sub 1.200 kcal/zi, calculatorul nu o „repară” prin rotunjire și nu afișează o țintă de slăbire. Menținerea rămâne vizibilă ca informație orientativă, împreună cu recomandarea unei evaluări profesionale.</p>
        </section>

        <details className="editorial-sources calorie-methodology">
          <summary><span>Metodologie și surse</span><i aria-hidden="true" /></summary>
          <div className="calorie-methodology-copy">
            <p>Metoda folosește Mifflin–St Jeor pentru metabolismul de repaus și factorii PAL descriși de EFSA și FAO/WHO/UNU. Intervalele pentru obiective sunt orientative și păstrează explicit incertitudinea individuală; calorimetria indirectă rămâne metoda de măsurare.</p>
          </div>
          <ol>
            {sources.map((source) => (
              <li key={source.url}>
                <div><strong>{source.institution}</strong><span>{source.context}</span></div>
                <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
              </li>
            ))}
          </ol>
        </details>
      </article>

      <section className="editorial-related calorie-related" aria-labelledby="calorie-related-title">
        <header>
          <p className="section-kicker">Continuă să citești</p>
          <h2 id="calorie-related-title">Articole recomandate</h2>
        </header>
        <div>{recommendations.map((article) => <ArticleCard key={article.slug} article={article} basePath="/alimentatie" compact />)}</div>
      </section>
    </main>
  );
}
