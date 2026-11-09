import Image from "next/image";
import Link from "next/link";
import { VemiNavigationDrawer } from "@/components/vemi-navigation-drawer";
import styles from "./amv2.module.css";

export function Amv2Header() {
  return (
    <header className={`site-header ${styles.siteHeader}`} data-amv2-header="true">
      <Link className="brand" href="/" aria-label="VEMI - Acasă">
        <Image
          className="brand-logo"
          src="/vemi-logo.png"
          alt="VEMI"
          width={130}
          height={44}
          priority
          unoptimized
        />
      </Link>
      <VemiNavigationDrawer knownHasWorkout={null} />
    </header>
  );
}
