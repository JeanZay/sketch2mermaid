# ADR-001 — Sketch2Mermaid : positionnement, architecture et spécification d'implémentation de la v0

## Statut

Accepté — prêt pour implémentation

## Date

22 juin 2026

## Public de ce document

Ce document a deux lecteurs. La première moitié (Contexte → Justification) enregistre les **décisions** et leurs raisons : c'est un ADR classique. La seconde moitié (Modèle de données → Découpage des lots) est une **spécification contraignante** destinée à un agent de coding : ce qui y est écrit est normatif et ne doit pas être réinterprété. Quand le document dit « MUST / NE DOIT PAS », il s'agit d'une contrainte d'implémentation, pas d'une suggestion.

---

## Contexte

Les utilisateurs métier savent représenter une idée sous forme de diagramme — un processus, une décision, un flux — mais ne veulent pas apprendre une syntaxe textuelle. Parallèlement, les LLM exploitent bien mieux une représentation textuelle structurée qu'une image. Mermaid est le bon format pivot : lisible par un humain technique, versionnable dans Git, intégrable dans Markdown, exploitable par un LLM.

**Sketch2Mermaid** comble cet écart : permettre de construire visuellement des diagrammes simples, puis d'obtenir automatiquement du Mermaid propre.

Deux clarifications, par rapport aux premières intentions, fixent désormais le périmètre et lèvent les ambiguïtés de la version initiale de cet ADR :

1. Malgré son nom, le produit **n'est pas** un outil de reconnaissance de croquis à main levée. La v0 est un **éditeur structuré nœuds-arêtes** — un « draw.io allégé » — où l'on pose des nœuds et trace des liens via une palette.
2. La v0 est **unidirectionnelle** : éditeur → Mermaid. L'import Mermaid → éditeur est **hors périmètre v0** et reporté en v2. C'est le sens difficile (parser, layout) ; on ne le traite pas tant que la boucle de génération n'a pas fait ses preuves.

L'ambition n'est pas de concurrencer draw.io sur sa surface. Le différenciateur réel est la **destination LLM** des diagrammes produits ; il sera développé en v2, mais l'architecture v0 doit déjà le rendre naturel.

---

## Décisions verrouillées

1. **Nom** : Sketch2Mermaid.
2. **Produit v0** : application web, gratuite, open source, sans backend.
3. **Cible v0** : flowcharts simples uniquement.
4. **Source de vérité** : un **modèle JSON canonique** interne. Mermaid est une **sortie générée**, jamais la source de vérité.
5. **Sens unique en v0** : génération éditeur → Mermaid. **Aucun import Mermaid en v0.**
6. **Invariant fondateur** : *le canvas ne peut produire que ce que Mermaid flowchart sait exprimer.* Le modèle canonique est, à la position près, un AST de flowchart Mermaid — pas un modèle de dessin générique. Toute fonctionnalité de canvas sans équivalent Mermaid est interdite en v0 (voir Non-objectifs).
7. **Les positions sont des métadonnées d'édition.** Elles servent uniquement à l'affichage dans l'éditeur. Elles **NE DOIVENT PAS** apparaître dans le Mermaid généré : Mermaid relayoute lui-même.
8. **Vue de travail = le canvas.** La preview Mermaid (rendu mermaid.js) sert à *valider* que la sortie est correcte, pas à faire autorité sur la mise en page.
9. **Extension VS Code** : horizon (v3), pas point de départ.

Boucle cible de la v0 :

```text
Éditeur structuré (canvas)
        ↓
Modèle JSON canonique (AST flowchart + positions)
        ↓  (fonction pure toMermaid)
Mermaid propre (texte)
        ↓
Presse-papiers + preview de validation (mermaid.js)
```

---

## Justification

### Pourquoi un JSON canonique et non Mermaid comme source de vérité

Mermaid décrit la structure logique mais ne conserve ni les positions, ni le layout manuel, ni les métadonnées d'édition. En faire la source de vérité rendrait l'édition fragile et fermerait l'évolution du produit. Le modèle interne sécurise nœuds, arêtes, formes, labels, positions et extensions futures.

### Pourquoi unidirectionnel en v0

Dans le sens éditeur → Mermaid, la conversion est une sérialisation quasi mécanique : pas de grammaire à interpréter. Toute la difficulté de l'import (parser le sous-ensemble Mermaid, puis recalculer un layout absent via dagre/elk) est ainsi **éliminée** du périmètre, et non simplement repoussée. La v0 prouve la boucle là où elle est cheap, et concentre l'effort sur ce qui reste réellement difficile : l'éditeur et la **correction de l'émission**.

### Où est la vraie difficulté

Elle n'est ni mathématique ni architecturale. Elle tient en deux points :

- **L'éditeur** reste l'essentiel de l'effort. On le rend tractable en s'appuyant sur une bibliothèque de graphe éprouvée (React Flow), pas en réécrivant le drag/connect/selection.
- **L'émission correcte.** Un label métier français (« Décision : valider (oui/non) ? ») casse Mermaid s'il n'est pas quoté/échappé. La fonction `toMermaid` est donc le composant à tester le plus sérieusement.

### Comment l'invariant neutralise les pièges Mermaid « par construction »

Les pièges classiques de Mermaid (le nœud nommé `end` en minuscules qui casse le flowchart ; un id commençant par `o`/`x` qui crée une arête cercle/croix) ne mordent que lorsque l'**id** ou le **texte non quoté** est dérivé du label utilisateur. Notre modèle **génère des id synthétiques** (`n1`, `n2`, …) découplés des labels, et **quote systématiquement** les labels. Ces deux choix éliminent structurellement ces pièges. Ne reste à gérer que l'échappement du **contenu** du label.

### Options écartées

- **Mermaid comme source de vérité unique** : perte du layout, édition fragile, import complexe. Rejetée.
- **Import Mermaid bidirectionnel en v0** : parser + layout = le gros du risque, sans valeur produit tant que la génération n'est pas prouvée. Reportée en v2.
- **Clone riche de draw.io** : dispersion, concurrence frontale, surface ingérable. Rejetée.

---

## Périmètre v0

### Inclus (et rien d'autre)

- Création d'un flowchart unique.
- Ajout de nœuds via palette ; 6 formes (voir modèle).
- Édition inline du label d'un nœud.
- Changement de forme d'un nœud.
- Tracé de liens entre nœuds (drag depuis un handle).
- Label optionnel sur les liens ; 2 styles de liens (plein, pointillé).
- Choix de direction : `TD`, `LR`, `BT`, `RL` (défaut `TD`).
- Suppression nœud/lien.
- Pan & zoom du canvas.
- Génération Mermaid en direct (panneau texte).
- Bouton « Copier le Mermaid ».
- Preview de validation via mermaid.js.
- Sauvegarde/restauration locale du modèle JSON (localStorage).
- Action « Nouveau » (réinitialisation).

### Exclus de la v0 (Non-objectifs)

Hors périmètre, et **interdits** car ils violeraient l'invariant fondateur ou la discipline de scope :

- Import Mermaid (→ v2).
- Reconnaissance de croquis à main levée.
- Flèches libres, texte flottant, formes hors vocabulaire flowchart, groupes/conteneurs visuels arbitraires, subgraphs.
- Couleurs/styles arbitraires par nœud, thèmes avancés.
- Autres types de diagrammes (BPMN, UML, sequence, class, ER, Gantt).
- Comptes utilisateurs, collaboration temps réel, synchronisation cloud, backend.
- Multi-pages / multi-diagrammes.

> Règle anti-dérive : toute proposition de fonctionnalité de canvas doit répondre « oui » à « Mermaid flowchart sait-il exprimer ça ? ». Sinon, elle est refusée en v0.

---

## Modèle de données canonique (normatif)

Source de vérité unique de l'application. Toute interaction utilisateur modifie ce modèle ; tout le reste (rendu canvas, Mermaid, persistance) en dérive.

```jsonc
{
  "schemaVersion": 1,
  "diagramType": "flowchart",          // constante en v0
  "direction": "TD",                    // "TD" | "LR" | "BT" | "RL"
  "nodes": [
    {
      "id": "n1",                       // synthétique, stable, jamais dérivé du label
      "label": "Demande reçue",         // texte libre UTF-8 (accents, ponctuation autorisés)
      "shape": "stadium",               // "process" | "rounded" | "stadium" | "decision" | "event" | "endEvent"
      "position": { "x": 120, "y": 80 } // métadonnée d'édition — NON émise en Mermaid
    }
  ],
  "edges": [
    {
      "id": "e1",                       // synthétique, stable
      "from": "n1",                     // référence un node.id existant
      "to": "n2",
      "label": "",                      // optionnel ; "" = pas de label
      "style": "solid"                  // "solid" | "dotted"
    }
  ]
}
```

### Contraintes du modèle (MUST)

- `id` des nœuds : générés selon `n` + compteur monotone (`n1`, `n2`, …). **Stables** : un id attribué ne change jamais, y compris quand le label change. Idem pour les arêtes (`e1`, `e2`, …).
- `id` **NE DOIT PAS** être dérivé du label. (C'est ce qui neutralise les pièges `end`, `o`/`x`.)
- `shape` ∈ { `process`, `rounded`, `stadium`, `decision`, `event`, `endEvent` } — aucune autre valeur acceptée.
- `style` ∈ { `solid`, `dotted` }.
- `from`/`to` référencent toujours des nœuds existants ; supprimer un nœud supprime les arêtes incidentes.
- `position` n'a aucune incidence sur la sortie Mermaid.
- `schemaVersion` est écrit dans le localStorage ; au chargement, un `schemaVersion` inconnu **NE DOIT PAS** crasher l'app (fallback : diagramme vide + avertissement console).

---

## Contrat de génération `toMermaid` (normatif)

`toMermaid(model) -> string` est une **fonction pure et déterministe** : un même modèle produit une sortie **octet pour octet identique** (ordre stable des nœuds puis des arêtes, par id croissant). Aucune position n'apparaît dans la sortie.

### Forme générale

```text
flowchart <direction>
  <déclarations de nœuds, une par ligne>
  <déclarations d'arêtes, une par ligne>
```

### Déclaration d'un nœud

`<id><ouvrant>"<label_échappé>"<fermant>` — le label est **toujours** entre guillemets, même s'il est simple.

| shape      | ouvrant | fermant | exemple                       |
| ---------- | ------- | ------- | ----------------------------- |
| `process`  | `[`     | `]`     | `n1["Étape"]`                 |
| `rounded`  | `(`     | `)`     | `n1("Étape")`                 |
| `stadium`  | `([`    | `])`    | `n1(["Début"])`               |
| `decision` | `{`     | `}`     | `n1{"Données suffisantes ?"}` |
| `event`    | `((`    | `))`    | `n1(("Début"))`               |
| `endEvent` | `(((`   | `)))`   | `n1((("Fin")))`               |

### Déclaration d'une arête

- Sans label : `<from> <connecteur> <to>`
- Avec label : `<from> <connecteur>|"<label_échappé>"|<to>`

| style    | connecteur |
| -------- | ---------- |
| `solid`  | `-->`      |
| `dotted` | `-.->`     |

### Échappement du label (`escapeLabel`)

Appliqué à tout label de nœud **et** d'arête, dans cet ordre :

1. `&` → `&amp;` (en premier)
2. `<` → `&lt;`
3. `>` → `&gt;`
4. `"` → `#quot;`
5. `#` → `#35;`  *(uniquement les `#` littéraux ; appliquer après l'étape 4 pour ne pas réémettre les `#` introduits par `#quot;` — voir note)*
6. saut de ligne → `<br/>`

> Note d'implémentation : l'étape 5 ne doit pas ré-échapper les `#` produits par `#quot;`. Implémenter l'échappement en une seule passe caractère par caractère (et non par `replace` successifs) pour éviter ce télescopage. La table ci-dessus décrit le **mapping cible** par caractère source, pas une séquence de `String.replace`.

Le quotage systématique + l'échappement ci-dessus couvrent les cas réels : apostrophes, deux-points, parenthèses, esperluettes, chevrons, dièses, guillemets, retours à la ligne.

### Exemple normatif

Modèle :

```json
{ "schemaVersion": 1, "diagramType": "flowchart", "direction": "TD",
  "nodes": [
    { "id": "n1", "label": "Demande reçue", "shape": "stadium", "position": {"x":0,"y":0} },
    { "id": "n2", "label": "Données suffisantes ?", "shape": "decision", "position": {"x":0,"y":100} }
  ],
  "edges": [ { "id": "e1", "from": "n1", "to": "n2", "label": "", "style": "solid" } ]
}
```

Sortie attendue (exacte) :

```text
flowchart TD
  n1(["Demande reçue"])
  n2{"Données suffisantes ?"}
  n1 --> n2
```

---

## Modèle d'interaction de l'éditeur (normatif)

| Action utilisateur                         | Comportement attendu                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| Clic sur une forme de la palette puis canvas, **ou** double-clic sur le canvas | Crée un nœud `process` à la position, label placeholder, immédiatement éditable |
| Double-clic sur un nœud                    | Édition inline du label                                                           |
| Sélection nœud + sélecteur de forme        | Change `shape` sans changer l'`id`                                               |
| Drag depuis le handle d'un nœud vers un autre | Crée une arête `solid` ; toggle pour `dotted`                                  |
| Double-clic sur une arête                  | Édition inline du label de l'arête                                               |
| Touche Suppr sur sélection                 | Supprime nœud(s)/arête(s) ; supprimer un nœud supprime ses arêtes incidentes     |
| Sélecteur de direction (toolbar)           | Met à jour `direction`                                                           |
| Bouton « Copier le Mermaid »               | Copie la sortie `toMermaid` courante dans le presse-papiers                      |
| Panneau Mermaid                            | Affiche la sortie `toMermaid` en direct                                          |
| Panneau preview                            | Rend la sortie via mermaid.js ; en cas d'erreur de parsing, affiche le message   |
| Bouton « Nouveau »                         | Réinitialise le modèle (avec confirmation)                                       |

Persistance : autosave (debounce 300–500 ms) du modèle canonique en localStorage sous une clé versionnée ; restauration au démarrage.

---

## Stack technique imposée (normatif)

L'agent **NE DOIT PAS** choisir librement la stack ; elle est fixée pour garantir l'éditeur sans réinventer le canvas :

- **Build / langage** : Vite + React + TypeScript.
- **Éditeur de graphe** : `@xyflow/react` (React Flow). Gère drag, handles, connexion, sélection, pan/zoom. Les nœuds custom rendent les 4 formes.
- **État** : `zustand`. Le **modèle canonique** vit dans le store et est l'unique source de vérité. Les nœuds/arêtes React Flow sont **dérivés** du modèle (sélecteur) ; les handlers React Flow réécrivent le modèle. Pas de double source de vérité.
- **Rendu de validation** : `mermaid` (mermaid.js), version épinglée. Utilisé pour le panneau preview et, en test, via `mermaid.parse()`.
- **Persistance** : `localStorage`. Aucun backend, aucun routeur.
- **Tests** : `vitest`. La batterie d'acceptation ci-dessous est exécutable.

Contrainte d'architecture : `toMermaid` et le modèle canonique vivent dans un module **sans dépendance à React ni à React Flow** (cœur pur, réutilisable plus tard par l'extension VS Code et la v2).

---

## Critères d'acceptation (testables, normatifs)

Les critères « rend sans erreur » s'implémentent en passant la sortie `toMermaid` à `mermaid.parse()` et en asseyant qu'aucune exception n'est levée.

- **AC1** — Diagramme vide → sortie = `flowchart TD` (en-tête seul), parsée sans erreur.
- **AC2** — Deux nœuds + une arête → sortie **exactement** égale à l'exemple normatif ci-dessus (test de snapshot).
- **AC3** — Label `Décision : valider (oui/non) ?` → parsé sans erreur.
- **AC4** — Nœud de label `end` (minuscules) → parsé sans erreur.
- **AC5** — Label contenant `< > & # "` → parsé sans erreur.
- **AC6** — Label commençant par `o` puis par `x` → parsé sans erreur (garanti par les id synthétiques ; à tester quand même).
- **AC7** — Arête avec label contenant des caractères spéciaux → parsée sans erreur.
- **AC8** — Renommer un nœud **ne modifie pas** son `id` (stabilité d'id).
- **AC9** — La sortie Mermaid **ne contient aucune** coordonnée `x`/`y` (non-fuite des positions).
- **AC10** — Rechargement de la page → modèle restauré identique depuis localStorage.
- **AC11** — « Copier » place la sortie courante dans le presse-papiers.
- **AC12** — Déterminisme : un même modèle produit une sortie octet-identique sur 100 appels ; l'ordre des lignes suit l'ordre des id.
- **AC13** — Supprimer un nœud supprime ses arêtes incidentes (aucune arête orpheline dans le modèle ni dans la sortie).
- **AC14** — `schemaVersion` inconnu au chargement → pas de crash, diagramme vide + avertissement console.

---

## Découpage en lots pour l'agent

Ordre imposé : la correction du cœur avant l'UI. Le **Lot 1 prouve la boucle de conversion sans aucune interface** — c'est l'objectif v0.

- **Lot 0 — Échafaudage.** Vite + React + TS + `@xyflow/react` + `zustand` + `mermaid` + `vitest`. Types du modèle canonique + store zustand (CRUD nœuds/arêtes, génération d'id synthétiques stables, direction).
- **Lot 1 — `toMermaid` + tests.** Fonction pure, `escapeLabel`, mapping des formes/connecteurs. Batterie AC1–AC9, AC12. **Aucune UI requise** ; livrable testable seul. C'est la preuve de la boucle.
- **Lot 2 — Éditeur (canvas).** Nœuds custom (4 formes) liés au modèle, palette, double-clic créer/éditer, drag-connect, changement de forme, suppression (AC13), direction, pan/zoom.
- **Lot 3 — Sortie & validation.** Panneau Mermaid en direct, bouton Copier (AC11), panneau preview mermaid.js avec gestion d'erreur.
- **Lot 4 — Persistance.** Autosave + restauration localStorage (AC10), gestion `schemaVersion` (AC14), bouton Nouveau.

Critère de « v0 terminée » : tous les AC passent et un utilisateur non technique peut construire un flowchart de 5–6 nœuds et coller un Mermaid valide ailleurs sans toucher au texte.

---

## Conséquences

### Positives

- Positionnement clair ; MVP réaliste et borné.
- Utile au métier sans apprentissage de Mermaid.
- Cœur pur (`toMermaid` + modèle) réutilisable par l'extension VS Code (v3) et la couche LLM (v2).
- Diagrammes immédiatement exploitables par un LLM.
- Vit naturellement sur GitHub.

### Négatives / à assumer

- La v0 ne réimporte pas de Mermaid externe (assumé, documenté).
- La mise en page de l'utilisateur n'est pas transmise à Mermaid (Mermaid relayoute) ; le canvas reste la vue de travail.
- Le modèle JSON est un format propre au projet.
- Le produit ne prétend pas remplacer draw.io.

---

## Horizon (hors v0, pour ancrer le scope — non spécifié ici)

- **v1** — Templates, exemples, documentation, ergonomie.
- **v2 — IA-ready (différenciateur réel)** : « copier pour LLM » (Mermaid + résumé textuel), génération de user stories / règles métier, détection de nœuds orphelins et de chemins sans issue. **Import Mermaid** (parser sous-ensemble + layout dagre/elk) arrive ici, pas avant.
- **v3 — Extension VS Code** : réutilise le cœur pur ; ouverture/édition/preview de `.mmd`.

---

## Risques

| Risque                              | Gravité | Mitigation                                                        |
| ----------------------------------- | ------: | ----------------------------------------------------------------- |
| Dérive vers un clone de draw.io     |  Élevée | Invariant fondateur + liste de Non-objectifs interdits            |
| Mermaid généré qui ne parse pas     |  Élevée | `toMermaid` testée contre `mermaid.parse()` (AC3–AC7), id synthétiques + quotage systématique |
| Sous-estimation de l'éditeur        | Moyenne | React Flow imposé ; éditeur traité comme un lot à part entière    |
| Double source de vérité (RF vs modèle) | Moyenne | Modèle canonique unique dans zustand ; RF dérivé                  |
| Feature creep du canvas             | Moyenne | Règle anti-dérive : « Mermaid sait-il l'exprimer ? »              |
| Confusion JSON ↔ Mermaid            |  Faible | JSON = interne ; Mermaid = export ; positions = édition seule     |

---

## Résumé

```text
Nom                 : Sketch2Mermaid
Public              : utilisateurs métier + équipes produit/data/dev
Format pivot        : Mermaid (sortie)
Source de vérité    : JSON canonique interne (AST flowchart + positions)
Sens v0             : éditeur → Mermaid (unidirectionnel ; pas d'import)
Périmètre v0        : flowcharts simples, 6 formes, 2 styles de liens
Invariant           : le canvas ne produit que ce que Mermaid sait exprimer
Stack               : Vite + React + TS + React Flow + zustand + mermaid.js
Cœur                : toMermaid pur, déterministe, testé contre mermaid.parse
Distribution        : web app open source, sans backend
Différenciateur réel: destination LLM (v2)
```

---

## ADR Addendum — Edge Label Layout Spacing (June 2026)

### Decision

Edge label dimensions are passed to Dagre's `g.setEdge()` as `{ width, height, labelpos }`
so that Dagre's native `makeSpaceForEdgeLabels` pipeline reserves space via proxy nodes.

### Why deterministic estimation, not `measureText`

Label size is estimated via `label.length * LABEL_CHAR_WIDTH + LABEL_PADDING_X` rather than
DOM-based `measureText` or `canvas.measureText`. Rationale:
- **Environment stability**: layout must be identical in Node.js tests and browser rendering.
- **Reproducibility**: `measureText` varies across OS, font availability, and browser version.
- **No DOM dependency**: the layout engine is a pure function with no React/DOM imports.
- **Single-line assumed**: `LABEL_LINE_HEIGHT` is fixed. If labels ever support wrapping (e.g., `<br>`), width would be over-estimated and height under-estimated. For single-line Mermaid edge labels, this is exact.

### Constants and their derivation

| Constant | Value | Derivation |
|---|---|---|
| `LABEL_CHAR_WIDTH` | 7 px/char | **Conservative over-estimate**, not a font metric. True average advance of 10px sans-serif ≈ 5–5.5 px/char. The ~35% safety margin absorbs wide glyphs (W, M, @). Overlap is a bug; extra whitespace is a cosmetic trade-off. |
| `LABEL_PADDING_X` | 32 px | CSS pill padding (3+8 px/side = 22px) + visual clearance. |
| `LABEL_LINE_HEIGHT` | 20 px | Single-line height including CSS border, padding, shadow. |
| `BASE_RANK_GAP` | 60 px | Dagre halves internally (→ 30) then doubles `minlen` for labeled edges. Net unlabeled ≈ 60. |
| `BASE_NODE_GAP` | 50 px | Intra-rank node separation. |
| `BASE_EDGE_GAP` | 10 px | Intra-rank edge separation. |

### Heuristic nature of the fix

Dagre reserves space at the **proxy node's** position (split-rank midpoint). The renderer
draws the label at the **bezier curve's** t=0.5 midpoint between handles. These two points
do not coincide for curved edges. Task A is therefore a heuristic that increases the
probability of non-overlap by widening the gap between nodes. The test suite validates
at the renderer's actual position using `getBezierPath`.

If the heuristic proves insufficient for specific topologies (e.g. multi-rank edges with
sharp curves), the fallback is to pass Dagre's computed label coordinates through to the
renderer as a `labelX`/`labelY` override, reconciling the two positions.

### Reliance on Dagre's native label proxy

Dagre's `layout()` pipeline runs `makeSpaceForEdgeLabels` → `injectEdgeLabelProxies`.
When an edge has non-zero `width`/`height`, a dummy node is inserted carrying those
dimensions. This proxy participates in both ranking and coordinate assignment. The
LR/RL coordinate-system swap maps axes automatically.

No custom per-direction rank-gap formulas are needed.
