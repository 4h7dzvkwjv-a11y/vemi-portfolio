"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { VemiNavigationDrawer } from "../../components/vemi-navigation-drawer";
import { WorkoutNavigationLink } from "../../components/workout-navigation-link";
import {
  flushPendingProgressMutations,
  importAnonymousProgressByChoice,
  loadCloudProgress,
  onProgressSessionChange,
  pendingProgressMutationCount,
  restoreProgressSession,
} from "../../utils/progress/client";
import {
  cloudProgressConfirmsImport,
  dismissAnonymousImportForSession,
  ensureLocalProgressMigration,
  isAnonymousImportDismissed,
  markAnonymousProgressImported,
  readPendingAnonymousProgress,
  type AnonymousProgressSnapshot,
} from "../../utils/progress/anonymous";
import {
  initialAuthState,
  requestPasswordResetAction,
  signInAction,
  signOutAction,
  signUpAction,
} from "./actions";

type Mode = "login" | "signup" | "recovery";

type Account = {
  username: string;
  email: string;
  role: "user" | "admin";
};

type Dashboard = {
  activePlan: null | {
    title: string;
    place: "acasa" | "sala";
    week: number;
    day: number;
    completed: number;
    total: number;
    progress: number;
    nextWorkout: string;
  };
  lastWorkout: null | { name: string; date: string; duration: number; exerciseCount: number };
  history: Array<{ id: string; name: string; date: string; duration: number; exerciseCount: number; source: string }>;
  customWorkouts: Array<{ id: string; name: string; place: "acasa" | "sala"; exerciseCount: number; completions: number; lastCompleted?: string }>;
};

function Header({ knownHasWorkout }: { knownHasWorkout?: boolean }) {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="VEMI - Acasă">
        <img className="brand-logo" src="/vemi-logo.png" alt="VEMI" />
      </Link>
      <VemiNavigationDrawer knownHasWorkout={knownHasWorkout} />
      <nav className="nav">
        <Link href="/planuri-gratuite">Planuri gratuite</Link>
        <WorkoutNavigationLink knownHasWorkout={knownHasWorkout}>Antrenamentul meu</WorkoutNavigationLink>
        <Link href="/exercitii">Exerciții</Link>
        <Link href="/stil-de-viata">Stil de viață</Link>
        <Link href="/alimentatie">Alimentație</Link>
        <Link className="nav-cta" href="/abonamente">Abonamente</Link>
        <Link className="nav-account" href="/contul-meu" aria-current="page">
          <span className="nav-account-icon" aria-hidden="true" />
          Contul meu
        </Link>
      </nav>
    </header>
  );
}

function AuthCard({ mode, onMode, returnTo }: { mode: Mode; onMode: (mode: Mode) => void; returnTo?: string }) {
  const [loginState, loginAction, loginPending] = useActionState(signInAction, initialAuthState);
  const [signupState, signupAction, signupPending] = useActionState(signUpAction, initialAuthState);
  const [resetState, resetAction, resetPending] = useActionState(
    requestPasswordResetAction,
    initialAuthState,
  );

  if (mode === "signup") {
    return (
      <div className="account-login-card">
        <form className="account-form" action={signupAction}>
          <label className="account-field">
            <span>Username</span>
            <input name="username" placeholder="ex: andrei.vemi" minLength={3} maxLength={30} pattern="[a-zA-Z0-9._-]+" required autoComplete="username" />
          </label>
          <label className="account-field">
            <span>E-mail</span>
            <input type="email" name="email" placeholder="nume@email.ro" required autoComplete="email" />
          </label>
          <label className="account-field">
            <span>Parolă</span>
            <input type="password" name="password" placeholder="Minimum 8 caractere" minLength={8} required autoComplete="new-password" />
          </label>
          <button className="account-login-button" type="submit" disabled={signupPending}>
            {signupPending ? "Se creează…" : "Creează cont gratuit"}
          </button>
          {signupState.message ? <p className={`account-form-message ${signupState.status}`}>{signupState.message}</p> : null}
        </form>
        <div className="account-divider"><span>Ai deja un cont?</span></div>
        <button className="account-create-button account-secondary-button" type="button" onClick={() => onMode("login")}>Intră în cont</button>
      </div>
    );
  }

  if (mode === "recovery") {
    return (
      <div className="account-login-card">
        <form className="account-form" action={resetAction}>
          <label className="account-field">
            <span>E-mail</span>
            <input type="email" name="email" placeholder="nume@email.ro" required autoComplete="email" />
          </label>
          <button className="account-login-button" type="submit" disabled={resetPending}>
            {resetPending ? "Se trimite…" : "Trimite linkul temporar"}
          </button>
          {resetState.message ? <p className={`account-form-message ${resetState.status}`}>{resetState.message}</p> : null}
        </form>
        <div className="account-divider"><span>Ți-ai amintit parola?</span></div>
        <button className="account-create-button account-secondary-button" type="button" onClick={() => onMode("login")}>Înapoi la autentificare</button>
      </div>
    );
  }

  return (
    <div className="account-login-card">
      <form className="account-form" action={loginAction}>
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
        <label className="account-field">
          <span>E-mail</span>
          <input type="email" name="email" placeholder="nume@email.ro" required autoComplete="email" />
        </label>
        <label className="account-field">
          <span>Parolă</span>
          <input type="password" name="password" placeholder="Introdu parola" required autoComplete="current-password" />
        </label>
        <button className="account-login-button" type="submit" disabled={loginPending}>
          {loginPending ? "Se verifică…" : "Intră în cont"}
        </button>
        {loginState.message ? <p className={`account-form-message ${loginState.status}`}>{loginState.message}</p> : null}
        <button className="account-text-button" type="button" onClick={() => onMode("recovery")}>Ai uitat parola?</button>
      </form>
      <div className="account-divider"><span>Nu ai încă un cont?</span></div>
      <button className="account-create-button" type="button" onClick={() => onMode("signup")}>Creează cont gratuit</button>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  }).format(new Date(value));
}

function AccountDashboard({ account, dashboard }: { account: Account; dashboard: Dashboard | null }) {
  const plan = dashboard?.activePlan;
  const last = dashboard?.lastWorkout;
  return (
    <div className="account-dashboard">
      <section className="account-welcome">
        <div className="account-profile-mark" aria-hidden="true">{account.username.slice(0, 1).toUpperCase()}</div>
        <div>
          <p className="section-kicker">Profil activ · {account.role === "admin" ? "Administrator" : "Cont gratuit"}</p>
          <h2>Bine ai revenit, {account.username}.</h2>
          <p>{account.email}</p>
        </div>
        <div className="account-welcome-actions">
          {account.role === "admin" ? (
            <Link
              className="account-admin-video-entry"
              href="/admin/exercitii-video"
              aria-label="Deschide panoul de administrare video"
            >
              Administrare video <span aria-hidden="true">→</span>
            </Link>
          ) : null}
          <form action={signOutAction}>
            <button className="account-dashboard-logout" type="submit">Deconectează-te</button>
          </form>
        </div>
      </section>

      {dashboard === null ? (
        <section className="account-sync-notice">
          <strong>Progresul este pregătit pentru conectare.</strong>
          <p>Rulează migrarea SQL a Modulului 2 în Supabase, apoi această pagină va afișa automat datele sincronizate.</p>
        </section>
      ) : (
        <>
          <section className="account-dashboard-grid">
            <article className="account-plan-card">
              <div className="account-card-heading">
                <div><p className="section-kicker">Plan gratuit activ</p><h3>{plan?.title ?? "Alege primul tău plan"}</h3></div>
                {plan ? <span>{plan.place === "sala" ? "La sală" : "Acasă"}</span> : null}
              </div>
              {plan ? (
                <>
                  <div className="account-plan-position"><strong>Săptămâna {plan.week}</strong><span>Ziua {plan.day} · {plan.nextWorkout}</span></div>
                  <div className="account-progress-label"><span>Progres</span><strong>{plan.progress}%</strong></div>
                  <div className="account-progress-track"><i style={{ width: `${plan.progress}%` }} /></div>
                  <small>{plan.completed} din {plan.total} antrenamente finalizate</small>
                  <Link className="account-continue" href={`/planuri-gratuite?week=${plan.week}&day=${plan.day}`}>Continuă antrenamentul <span className="cta-arrow" aria-hidden="true">→</span></Link>
                </>
              ) : (
                <div className="account-empty-state"><p>Planul ales va apărea aici și va rămâne sincronizat între dispozitive.</p><Link href="/planuri-gratuite">Alege planul gratuit <span className="cta-arrow" aria-hidden="true">→</span></Link></div>
              )}
            </article>

            <article className="account-next-card">
              <p className="section-kicker">Ultimul antrenament</p>
              {last ? <><h3>{last.name}</h3><p>{formatDate(last.date)}</p><div><span>{last.exerciseCount} exerciții</span><span>{last.duration} min</span></div></> : <><h3>Primul rezultat începe aici.</h3><p>După finalizare, antrenamentul va apărea automat în jurnal.</p></>}
              <hr />
              <p className="section-kicker">Următorul antrenament</p>
              <h4>{plan?.nextWorkout ?? "Alege un plan gratuit"}</h4>
              {plan ? <span>Săptămâna {plan.week} · Ziua {plan.day}</span> : null}
            </article>
          </section>

          <section className="account-data-section">
            <header><div><p className="section-kicker">Jurnalul rezultatelor</p><h2>Istoricul antrenamentelor</h2></div><span>{dashboard.history.length} sesiuni recente</span></header>
            <div className="account-history-list">
              {dashboard.history.length ? dashboard.history.map((item) => (
                <article key={item.id}>
                  <i aria-hidden="true">✓</i><div><strong>{item.name}</strong><span>{item.source === "free_plan" ? "Plan gratuit" : "Antrenamentul meu"}</span></div>
                  <small>{formatDate(item.date)}</small><b>{item.exerciseCount} exerciții · {item.duration} min</b>
                </article>
              )) : <p className="account-list-empty">Antrenamentele finalizate vor apărea aici.</p>}
            </div>
          </section>

          <section className="account-data-section">
            <header><div><p className="section-kicker">Planurile tale</p><h2>Antrenamentul meu</h2></div><Link href="/antrenamentul-meu?creator=1">Creează antrenament <span className="cta-arrow" aria-hidden="true">→</span></Link></header>
            <div className="account-custom-grid">
              {dashboard.customWorkouts.length ? dashboard.customWorkouts.map((workout) => (
                <article key={workout.id}>
                  <span>{workout.place === "sala" ? "La sală" : "Acasă"}</span><h3>{workout.name}</h3>
                  <p>{workout.exerciseCount} exerciții · {workout.completions} finalizări</p>
                  <Link href={`/antrenamentul-meu?workout=${encodeURIComponent(workout.id)}`}>Deschide în carnet <b className="cta-arrow" aria-hidden="true">→</b></Link>
                </article>
              )) : <article className="account-custom-empty"><h3>Creează-l pe al tău.</h3><p>Seriile, repetările, greutățile, durata și exercițiile finalizate se salvează în cont.</p><Link href="/antrenamentul-meu?creator=1">Începe <span className="cta-arrow" aria-hidden="true">→</span></Link></article>}
            </div>
          </section>
        </>
      )}

      <section className="account-premium-zone" aria-label="Funcții Premium blocate">
        <header><div><p className="section-kicker">VEMI Premium</p><h2>Mai mult sprijin, când îl vrei.</h2></div><span>Blocat momentan</span></header>
        <div className="account-premium-grid">
          {["Chestionarul personal", "Programul personalizat", "Progres detaliat", "Asistență WhatsApp"].map((feature, index) => (
            <article key={feature}><span>0{index + 1}</span><h3>{feature}</h3><i aria-hidden="true">⌁</i></article>
          ))}
        </div>
        <p>Aceste funcții se vor debloca după abonare. Plățile și WhatsApp nu sunt activate în această etapă.</p>
      </section>
    </div>
  );
}

export function AccountClient({ account, dashboard, returnTo }: { account: Account | null; dashboard: Dashboard | null; returnTo?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [syncMessage, setSyncMessage] = useState("");
  const [anonymousProgress, setAnonymousProgress] = useState<AnonymousProgressSnapshot | null>(null);
  const [showImportPrompt, setShowImportPrompt] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  useEffect(() => {
    let disposed = false;
    let synchronizing = false;
    ensureLocalProgressMigration();

    const synchronizeAfterSessionRestore = async () => {
      if (synchronizing) return;
      synchronizing = true;
      try {
        const hasSession = await restoreProgressSession();
        if (!hasSession) return;
        let cloud = await loadCloudProgress();
        if (!cloud.authenticated) return;
        const flushed = await flushPendingProgressMutations();
        cloud = await loadCloudProgress();

        if (disposed) return;
        const pending = pendingProgressMutationCount();
        setSyncMessage(flushed.pending || pending
          ? "Unele operațiuni ale contului sunt încă în coada de siguranță și vor fi reîncercate automat."
          : "");
        const anonymous = readPendingAnonymousProgress();
        setAnonymousProgress(anonymous);
        setShowImportPrompt(Boolean(anonymous && !isAnonymousImportDismissed(anonymous.importId)));
        if (!account || flushed.confirmed > 0) router.refresh();
      } catch {
        if (!disposed) setSyncMessage("Conexiunea cu salvarea în cloud nu a fost confirmată. Datele locale au rămas intacte.");
      } finally {
        synchronizing = false;
      }
    };

    void synchronizeAfterSessionRestore();
    const resumeSync = () => {
      if (document.visibilityState === "visible") void synchronizeAfterSessionRestore();
    };
    const unsubscribeAuth = onProgressSessionChange(() => void synchronizeAfterSessionRestore());
    document.addEventListener("visibilitychange", resumeSync);
    window.addEventListener("pageshow", resumeSync);
    window.addEventListener("focus", resumeSync);
    return () => {
      disposed = true;
      unsubscribeAuth();
      document.removeEventListener("visibilitychange", resumeSync);
      window.removeEventListener("pageshow", resumeSync);
      window.removeEventListener("focus", resumeSync);
    };
  }, [account, router]);

  async function importAnonymousProgress() {
    if (!anonymousProgress || importing) return;
    setImporting(true);
    setImportMessage("");
    try {
      const result = await importAnonymousProgressByChoice(anonymousProgress.importId, anonymousProgress);
      if (!result.saved || !result.cloud || !result.userId || !cloudProgressConfirmsImport(anonymousProgress, result.cloud)) {
        throw new Error("Importul nu a fost confirmat prin recitirea progresului din cloud.");
      }
      markAnonymousProgressImported(anonymousProgress.importId, result.userId);
      setShowImportPrompt(false);
      setAnonymousProgress(null);
      setImportMessage("Progresul de pe acest dispozitiv a fost importat în cont.");
      router.refresh();
    } catch {
      setImportMessage("Progresul nu a putut fi importat momentan. Nu ai pierdut nimic. Încearcă din nou.");
    } finally {
      setImporting(false);
    }
  }

  function dismissAnonymousImport() {
    if (!anonymousProgress) return;
    dismissAnonymousImportForSession(anonymousProgress.importId);
    setShowImportPrompt(false);
    setImportMessage("Progresul local nu a fost modificat. Îl poți importa mai târziu din această pagină.");
  }

  return (
    <main className="account-page">
      <Header knownHasWorkout={account && dashboard ? dashboard.customWorkouts.length > 0 : undefined} />
      <section className="account-main">
        <header className="account-intro">
          <p className="section-kicker">Contul tău VEMI</p>
          <h1>Continuă de unde<br />ai rămas.</h1>
          <p>Un loc simplu pentru progresul, planurile și antrenamentele tale. Crearea contului este gratuită.</p>
        </header>

        {syncMessage ? <section className="account-sync-notice" role="status"><strong>Sincronizare în așteptare</strong><p>{syncMessage}</p></section> : null}
        {account && anonymousProgress ? <section className="account-sync-notice account-import-notice" aria-labelledby="anonymous-import-title">
          <strong id="anonymous-import-title">Am găsit progres salvat pe acest dispozitiv.</strong>
          <p>Îl poți importa în cont pentru a continua de unde ai rămas și pe alte dispozitive. Datele existente din cont sunt păstrate.</p>
          {showImportPrompt ? <div className="account-import-actions">
            <button className="account-login-button" type="button" onClick={() => void importAnonymousProgress()} disabled={importing}>{importing ? "Se importă progresul…" : "Importă progresul"}</button>
            <button className="account-create-button account-secondary-button" type="button" onClick={dismissAnonymousImport} disabled={importing}>Nu acum</button>
          </div> : <button className="account-text-button" type="button" onClick={() => { setShowImportPrompt(true); setImportMessage(""); }}>Importă progresul de pe acest dispozitiv</button>}
          <small>Progresul salvat înainte de cont poate fi importat numai din browserul și dispozitivul pe care a fost creat.</small>
        </section> : null}
        {importMessage ? <p className="account-form-message" role="status">{importMessage}</p> : null}
        {account ? <AccountDashboard account={account} dashboard={dashboard} /> : <AuthCard mode={mode} onMode={setMode} returnTo={returnTo} />}

        {!account ? <section className="account-benefits" aria-labelledby="account-benefits-title">
          <header className="account-benefits-header">
            <h2 id="account-benefits-title">De ce merită să ai un cont?</h2>
            <p>Mișcarea rămâne simplă. După autentificare, alegi dacă imporți progresul anonim de pe dispozitiv în cont.</p>
          </header>
          <div className="account-benefit-grid">
            <article className="account-benefit"><span className="account-benefit-number">01</span><h3>Complet gratuit</h3><p>Îți creezi contul fără abonament și fără costuri ascunse.</p></article>
            <article className="account-benefit"><span className="account-benefit-number">02</span><h3>Progres păstrat</h3><p>După importul ales de tine, continui planul gratuit din săptămâna și ziua în care ai rămas.</p></article>
            <article className="account-benefit"><span className="account-benefit-number">03</span><h3>Antrenamentele tale</h3><p>Păstrezi antrenamentele create și continuitatea din „Antrenamentul meu”.</p></article>
            <article className="account-benefit"><span className="account-benefit-number">04</span><h3>Oriunde te antrenezi</h3><p>Vei putea continua de pe telefon, tabletă sau calculator.</p></article>
          </div>
        </section> : null}
      </section>
      <footer>
        <div className="footer-brand"><img className="brand-logo footer-logo" src="/vemi-logo.png" alt="VEMI" /><p>Viață · Energie · Mișcare</p></div>
        <div className="footer-links"><Link href="/planuri-gratuite">Planuri</Link><Link href="/antrenamentul-meu">Antrenamentul meu</Link><Link href="/exercitii">Exerciții</Link><Link href="/stil-de-viata">Stil de viață</Link><Link href="/alimentatie">Alimentație</Link><Link href="/abonamente">Abonamente</Link><Link href="/contul-meu">Contul meu</Link></div>
        <p className="copyright">© 2026 VEMI. Prototip funcțional.</p>
      </footer>
    </main>
  );
}
