export type Recipe = {
  number: number;
  title: string;
  ingredients: string[];
  preparation: string[];
  servings: string;
  calories: number;
  protein: number;
  preparationTime: string;
};

export function RecipeBlock({
  number,
  title,
  ingredients,
  preparation,
  servings,
  calories,
  protein,
  preparationTime,
}: Recipe) {
  return (
    <section className="recipe-block" data-recipe-block data-recipe-number={number}>
      <header className="recipe-block-header">
        <span>Rețeta {number}</span>
        <h3>{title}</h3>
      </header>

      <dl className="recipe-block-facts" aria-label="Informații despre rețetă">
        <div>
          <dt>Porție</dt>
          <dd>{servings}</dd>
        </div>
        <div>
          <dt>Timp</dt>
          <dd>{preparationTime}</dd>
        </div>
        <div>
          <dt>Calorii aproximative</dt>
          <dd>~{calories} kcal / porție</dd>
        </div>
        <div>
          <dt>Proteine aproximative</dt>
          <dd>~{protein} g / porție</dd>
        </div>
      </dl>

      <div className="recipe-block-content">
        <div>
          <h4>Ingrediente</h4>
          <ul>{ingredients.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}</ul>
        </div>
        <div>
          <h4>Mod de preparare</h4>
          <ol>{preparation.map((step) => <li key={step}>{step}</li>)}</ol>
        </div>
      </div>
    </section>
  );
}
