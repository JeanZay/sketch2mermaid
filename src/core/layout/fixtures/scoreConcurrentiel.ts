/** Regression fixture for converging Mermaid/Dagre routes. */
export const SCORE_CONCURRENTIEL_MERMAID_FIXTURE = `flowchart TB
  Prix[Prix]
  Innovation[Innovation]
  Couverture[Couverture]
  Satisfaction[Satisfaction client]
  Score[Score concurrentiel]

  Prix --> Score
  Innovation --> Score
  Couverture --> Score
  Satisfaction --> Score`;

