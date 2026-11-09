import type { ReactNode } from "react";
import { EditorialFooter } from "@/components/editorial/editorial-footer";
import { EditorialHeader } from "@/components/editorial/editorial-header";

export default function LifestyleLayout({ children }: { children: ReactNode }) {
  return (
    <div className="editorial-site">
      <EditorialHeader />
      {children}
      <EditorialFooter />
    </div>
  );
}
