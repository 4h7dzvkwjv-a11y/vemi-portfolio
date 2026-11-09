import Link from "next/link";
import Image from "next/image";

export function EditorialFooter() {
  return (
    <footer>
      <div className="footer-brand">
        <Image className="brand-logo footer-logo" src="/vemi-logo.png" alt="VEMI" width={180} height={56} unoptimized />
        <p>Viață · Energie · Mișcare</p>
      </div>
      <div className="footer-links">
        <Link href="/planuri-gratuite">Planuri</Link>
        <Link href="/antrenamentul-meu">Antrenamentul meu</Link>
        <Link href="/exercitii">Exerciții</Link>
        <Link href="/stil-de-viata">Stil de viață</Link>
        <Link href="/alimentatie">Alimentație</Link>
        <Link href="/abonamente">Abonamente</Link>
        <Link href="/contul-meu">Contul meu</Link>
      </div>
      <p className="copyright">© 2026 VEMI. Informații generale pentru un stil de viață echilibrat.</p>
    </footer>
  );
}
