import { createElement, type ComponentType } from "react";
import SleepEssentialArticle from "./articles/somnul/de-ce-este-somnul-esential.mdx";
import SleepHoursArticle from "./articles/somnul/de-cate-ore-de-somn-ai-nevoie.mdx";
import SleepQualityArticle from "./articles/somnul/somn-putin-sau-somn-de-slaba-calitate.mdx";
import TiredAfterSleepArticle from "./articles/somnul/obosit-desi-ai-dormit-suficient.mdx";
import StressSleepArticle from "./articles/stresul/cum-afecteaza-stresul-somnul-si-recuperarea.mdx";
import PhysicalMentalStressArticle from "./articles/stresul/stres-fizic-versus-stres-psihic.mdx";
import StressSignsArticle from "./articles/stresul/semne-ca-stresul-te-afecteaza.mdx";
import ReduceStressArticle from "./articles/stresul/cum-reduci-stresul-fara-schimbari-radicale.mdx";
import WorkScheduleArticle from "./articles/munca-si-programul-zilnic/programul-de-munca-energia-si-somnul.mdx";
import DaytimeFatigueArticle from "./articles/munca-si-programul-zilnic/de-ce-apare-oboseala-in-timpul-zilei.mdx";
import OrganizeDayArticle from "./articles/munca-si-programul-zilnic/cum-iti-organizezi-ziua-pentru-mai-multa-energie.mdx";
import ShiftWorkArticle from "./articles/munca-si-programul-zilnic/munca-in-ture-si-programul-neregulat.mdx";
import RestBeyondSleepArticle from "./articles/recuperarea/odihna-inseamna-mai-mult-decat-somn.mdx";
import RecoveryOrCoffeeArticle from "./articles/recuperarea/recuperare-sau-mai-multa-cafea.mdx";
import SleepAppetiteTrainingArticle from "./articles/recuperarea/somnul-energia-pofta-de-mancare-si-antrenamentele.mdx";
import ImproveRecoveryArticle from "./articles/recuperarea/cum-iti-imbunatatesti-recuperarea.mdx";
import ExerciseTechniqueArticle from "./articles/antrenamentul/tehnica-exercitiilor-executie-controlata.mdx";
import WorkoutStructureArticle from "./articles/antrenamentul/cum-iti-structurezi-un-antrenament.mdx";
import TrainingProgressArticle from "./articles/antrenamentul/cum-progresezi-fara-sa-schimbi-programul.mdx";
import GoalTrainingArticle from "./articles/antrenamentul/cum-adaptezi-antrenamentul-la-obiectiv.mdx";
import MobilityNeedsArticle from "./articles/mobilitate-si-preventie/ce-inseamna-mobilitatea-si-cata-ai-nevoie.mdx";
import WarmupArticle from "./articles/mobilitate-si-preventie/incalzirea-inainte-de-antrenament.mdx";
import BodySignalsArticle from "./articles/mobilitate-si-preventie/semnalele-corpului-in-timpul-antrenamentului.mdx";
import ReturnToTrainingArticle from "./articles/mobilitate-si-preventie/cum-revii-treptat-la-antrenament-dupa-o-pauza.mdx";

const articleContent: Record<string, ComponentType<Record<string, never>>> = {
  "somnul/de-ce-este-somnul-esential": SleepEssentialArticle,
  "somnul/de-cate-ore-de-somn-ai-nevoie": SleepHoursArticle,
  "somnul/somn-putin-sau-somn-de-slaba-calitate": SleepQualityArticle,
  "somnul/obosit-desi-ai-dormit-suficient": TiredAfterSleepArticle,
  "stresul/cum-afecteaza-stresul-somnul-si-recuperarea": StressSleepArticle,
  "stresul/stres-fizic-versus-stres-psihic": PhysicalMentalStressArticle,
  "stresul/semne-ca-stresul-te-afecteaza": StressSignsArticle,
  "stresul/cum-reduci-stresul-fara-schimbari-radicale": ReduceStressArticle,
  "munca-si-programul-zilnic/programul-de-munca-energia-si-somnul": WorkScheduleArticle,
  "munca-si-programul-zilnic/de-ce-apare-oboseala-in-timpul-zilei": DaytimeFatigueArticle,
  "munca-si-programul-zilnic/cum-iti-organizezi-ziua-pentru-mai-multa-energie": OrganizeDayArticle,
  "munca-si-programul-zilnic/munca-in-ture-si-programul-neregulat": ShiftWorkArticle,
  "recuperarea/odihna-inseamna-mai-mult-decat-somn": RestBeyondSleepArticle,
  "recuperarea/recuperare-sau-mai-multa-cafea": RecoveryOrCoffeeArticle,
  "recuperarea/somnul-energia-pofta-de-mancare-si-antrenamentele": SleepAppetiteTrainingArticle,
  "recuperarea/cum-iti-imbunatatesti-recuperarea": ImproveRecoveryArticle,
  "antrenamentul/tehnica-exercitiilor-executie-controlata": ExerciseTechniqueArticle,
  "antrenamentul/cum-iti-structurezi-un-antrenament": WorkoutStructureArticle,
  "antrenamentul/cum-progresezi-fara-sa-schimbi-programul": TrainingProgressArticle,
  "antrenamentul/cum-adaptezi-antrenamentul-la-obiectiv": GoalTrainingArticle,
  "mobilitate-si-preventie/ce-inseamna-mobilitatea-si-cata-ai-nevoie": MobilityNeedsArticle,
  "mobilitate-si-preventie/incalzirea-inainte-de-antrenament": WarmupArticle,
  "mobilitate-si-preventie/semnalele-corpului-in-timpul-antrenamentului": BodySignalsArticle,
  "mobilitate-si-preventie/cum-revii-treptat-la-antrenament-dupa-o-pauza": ReturnToTrainingArticle,
};

export function getArticleContent(categorySlug: string, articleSlug: string) {
  const Content = articleContent[`${categorySlug}/${articleSlug}`];
  return Content ? createElement(Content) : null;
}
