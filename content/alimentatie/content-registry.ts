import { createElement, type ComponentType } from "react";
import CaloriesArticle from "./articles/bazele-alimentatiei/caloriile-ce-sunt-si-de-ce-conteaza.mdx";
import FoodQualityArticle from "./articles/bazele-alimentatiei/calitatea-alimentelor-vs-numarul-de-calorii.mdx";
import BalancedDietArticle from "./articles/bazele-alimentatiei/cum-arata-o-alimentatie-echilibrata.mdx";
import MacronutrientsArticle from "./articles/bazele-alimentatiei/proteine-carbohidrati-si-grasimi.mdx";
import DailyMealsArticle from "./articles/alimentatia-de-zi-cu-zi/cum-iti-organizezi-mesele-intr-o-zi.mdx";
import WorkoutNutritionArticle from "./articles/alimentatia-de-zi-cu-zi/ce-mananci-inainte-si-dupa-antrenament.mdx";
import SnacksArticle from "./articles/alimentatia-de-zi-cu-zi/gustarile-cand-ajuta-si-cand-adauga-calorii.mdx";
import QuickEatingArticle from "./articles/alimentatia-de-zi-cu-zi/cum-mananci-mai-bine-cand-ai-putin-timp.mdx";
import CalorieDeficitArticle from "./articles/alimentatia-pentru-obiectiv/deficitul-caloric-pentru-slabire.mdx";
import CalorieSurplusArticle from "./articles/alimentatia-pentru-obiectiv/surplusul-caloric-pentru-masa-musculara.mdx";
import WeightMaintenanceArticle from "./articles/alimentatia-pentru-obiectiv/mentinerea-greutatii-si-a-formei.mdx";
import NutritionPlateauArticle from "./articles/alimentatia-pentru-obiectiv/cum-ajustezi-alimentatia-cand-progresul-se-opreste.mdx";
import WeightLossRecipesArticle from "./articles/retete-simple/10-retete-simple-pentru-slabire.mdx";
import MuscleGainRecipesArticle from "./articles/retete-simple/10-retete-simple-pentru-masa-musculara.mdx";
import MaintenanceRecipesArticle from "./articles/retete-simple/10-retete-simple-pentru-mentinere.mdx";
import LactoseIntoleranceArticle from "./articles/restrictii-si-intolerante/intoleranta-la-lactoza-si-alimentatia.mdx";
import GlutenFreeArticle from "./articles/restrictii-si-intolerante/glutenul-si-alimentatia-fara-gluten.mdx";
import FoodAllergiesArticle from "./articles/restrictii-si-intolerante/alergii-alimentare-ce-trebuie-sa-ai-in-vedere.mdx";
import RestrictiveDietsArticle from "./articles/restrictii-si-intolerante/dietele-restrictive-si-riscul-de-carente.mdx";

const articleContent: Record<string, ComponentType<Record<string, never>>> = {
  "bazele-alimentatiei/caloriile-ce-sunt-si-de-ce-conteaza": CaloriesArticle,
  "bazele-alimentatiei/proteine-carbohidrati-si-grasimi": MacronutrientsArticle,
  "bazele-alimentatiei/cum-arata-o-alimentatie-echilibrata": BalancedDietArticle,
  "bazele-alimentatiei/calitatea-alimentelor-vs-numarul-de-calorii": FoodQualityArticle,
  "alimentatia-de-zi-cu-zi/cum-iti-organizezi-mesele-intr-o-zi": DailyMealsArticle,
  "alimentatia-de-zi-cu-zi/ce-mananci-inainte-si-dupa-antrenament": WorkoutNutritionArticle,
  "alimentatia-de-zi-cu-zi/gustarile-cand-ajuta-si-cand-adauga-calorii": SnacksArticle,
  "alimentatia-de-zi-cu-zi/cum-mananci-mai-bine-cand-ai-putin-timp": QuickEatingArticle,
  "alimentatia-pentru-obiectiv/deficitul-caloric-pentru-slabire": CalorieDeficitArticle,
  "alimentatia-pentru-obiectiv/surplusul-caloric-pentru-masa-musculara": CalorieSurplusArticle,
  "alimentatia-pentru-obiectiv/mentinerea-greutatii-si-a-formei": WeightMaintenanceArticle,
  "alimentatia-pentru-obiectiv/cum-ajustezi-alimentatia-cand-progresul-se-opreste": NutritionPlateauArticle,
  "retete-simple/10-retete-simple-pentru-slabire": WeightLossRecipesArticle,
  "retete-simple/10-retete-simple-pentru-masa-musculara": MuscleGainRecipesArticle,
  "retete-simple/10-retete-simple-pentru-mentinere": MaintenanceRecipesArticle,
  "restrictii-si-intolerante/intoleranta-la-lactoza-si-alimentatia": LactoseIntoleranceArticle,
  "restrictii-si-intolerante/glutenul-si-alimentatia-fara-gluten": GlutenFreeArticle,
  "restrictii-si-intolerante/alergii-alimentare-ce-trebuie-sa-ai-in-vedere": FoodAllergiesArticle,
  "restrictii-si-intolerante/dietele-restrictive-si-riscul-de-carente": RestrictiveDietsArticle,
};

export function getNutritionArticleContent(categorySlug: string, articleSlug: string) {
  const Content = articleContent[`${categorySlug}/${articleSlug}`];
  return Content ? createElement(Content) : null;
}
