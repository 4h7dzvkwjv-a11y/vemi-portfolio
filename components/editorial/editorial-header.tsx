import Link from "next/link";
import Image from "next/image";
import { VemiNavigationDrawer } from "../vemi-navigation-drawer";
import { WorkoutNavigationLink } from "../workout-navigation-link";

const links = [
  { href: "/planuri-gratuite", label: "Planuri gratuite" },
  { href: "/antrenamentul-meu", label: "Antrenamentul meu" },
  { href: "/exercitii", label: "Exerciții" },
  { href: "/stil-de-viata", label: "Stil de viață" },
  { href: "/alimentatie", label: "Alimentație" },
];

function EditorialNavigation() {
  return (
    <>
      {links.map((link) => link.href === "/antrenamentul-meu"
        ? <WorkoutNavigationLink key={link.href}>{link.label}</WorkoutNavigationLink>
        : <Link key={link.href} href={link.href}>{link.label}</Link>)}
      <Link className="nav-cta" href="/abonamente">Abonamente</Link>
      <Link className="nav-account" href="/contul-meu">
        <span className="nav-account-icon" aria-hidden="true" />
        Contul meu
      </Link>
    </>
  );
}

export function EditorialHeader() {
  return (
    <header className="site-header editorial-header">
      <Link className="brand" href="/" aria-label="VEMI - Acasă">
        <Image className="brand-logo" src="/vemi-logo.png" alt="VEMI" width={180} height={56} priority unoptimized />
      </Link>
      <nav className="nav editorial-desktop-nav" aria-label="Navigare principală">
        <EditorialNavigation />
      </nav>
      <VemiNavigationDrawer />
    </header>
  );
}
