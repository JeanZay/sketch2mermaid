import React from 'react';

export const UserGuide: React.FC = () => {
  return (
    <div className="user-guide-container">
      <div className="user-guide-header">
        <h3 className="user-guide-title">Mode d'emploi</h3>
        <p className="user-guide-subtitle">
          Découvrez comment créer rapidement des diagrammes et obtenir du code Mermaid propre.
        </p>
      </div>

      <div className="user-guide-content">
        {/* Section 1: Ajouter des formes */}
        <section className="user-guide-section">
          <div className="section-header-with-icon">
            <span className="section-icon">🧩</span>
            <h4>1. Ajouter des formes</h4>
          </div>
          <p>
            Cliquez sur l'une des formes du panneau de gauche (<strong>Processus</strong>, <strong>Décision</strong>, <strong>Cercle</strong>, <strong>Base de données</strong>, etc.) pour l'insérer au centre du canvas.
          </p>
        </section>

        {/* Section 2: Relier les nœuds */}
        <section className="user-guide-section">
          <div className="section-header-with-icon">
            <span className="section-icon">🔗</span>
            <h4>2. Relier les éléments</h4>
          </div>
          <p>
            Pour relier deux nœuds, glissez un lien depuis l'un des points d'ancrage (les petits cercles) d'un nœud vers un autre nœud. Vous pouvez aussi créer une <strong>flèche libre</strong> en cliquant sur l'icône de flèche dans la section <i>Connection</i> du panneau de gauche, puis faire glisser ses extrémités séparément. Relâchez une extrémité près d'un point d'ancrage de nœud pour l'y <strong>aimanter (snapping)</strong>.
          </p>
        </section>

        {/* Section 3: Personnaliser */}
        <section className="user-guide-section">
          <div className="section-header-with-icon">
            <span className="section-icon">⚙️</span>
            <h4>3. Personnaliser</h4>
          </div>
          <p>
            Cliquez sur un nœud ou une flèche du canvas pour afficher ses options dans le panneau de droite. Vous pourrez y modifier le <strong>texte</strong>, le style (<strong>gras</strong>, <strong>italique</strong>), la <strong>couleur</strong> ou encore changer la forme du nœud à la volée.
          </p>
        </section>

        {/* Section 4: Style de flèche */}
        <section className="user-guide-section">
          <div className="section-header-with-icon">
            <span className="section-icon">〰️</span>
            <h4>4. Style de liaison</h4>
          </div>
          <p>
            Pour passer une flèche en pointillés, sélectionnez-la sur le canvas puis cliquez sur <strong>Dotted</strong> dans la section <i>Connection</i> du panneau de gauche. Cliquez sur <strong>Solid</strong> pour revenir en ligne pleine.
          </p>
        </section>

        {/* Section 5: Conteneurs visuels */}
        <section className="user-guide-section">
          <div className="section-header-with-icon">
            <span className="section-icon">📦</span>
            <h4>5. Conteneurs visuels (Groupes & Couloirs)</h4>
          </div>
          <p>
            Ajoutez des conteneurs pour organiser vos nœuds via la section <i>Containers</i> du panneau de gauche :
          </p>
          <ul className="actions-guide-list">
            <li>
              <strong>Group (Subgraph)</strong> : Crée un conteneur rectangulaire standard.
            </li>
            <li>
              <strong>Swimlane (Couloir)</strong> : Crée une ligne d'eau (verticale ou horizontale).
            </li>
          </ul>
          <p>
            Vous pouvez également sélectionner plusieurs nœuds sur le canvas et cliquer sur <strong>Créer un Groupe (Subgraph)</strong> ou <strong>Créer une Ligne d'eau (Swimlane)</strong> dans le panneau de droite.
          </p>
          <p>
            Sélectionnez un conteneur pour modifier son <strong>label</strong>, son type, sa direction de rendu (Verticale TD / Horizontale LR, uniquement pour les Subgraphs), sa couleur de fond ou de bordure.
          </p>
          <div className="guide-note">
            ℹ️ Lors de la suppression d'un conteneur contenant des nœuds, une invite vous propose soit de supprimer le groupe et ses nœuds enfants, soit de supprimer uniquement le groupe en conservant les nœuds.
          </div>
        </section>

        {/* Section 6: Annotations */}
        <section className="user-guide-section">
          <div className="section-header-with-icon">
            <span className="section-icon">📝</span>
            <h4>6. Annotations textuelles</h4>
          </div>
          <p>
            Ajoutez des annotations libres grâce au bouton <strong>Text</strong> dans la section <i>Annotations</i> du panneau de gauche.
          </p>
          <div className="guide-note">
            ⚠️ Les annotations textuelles sont purement visuelles et ne sont pas incluses dans le code Mermaid exporté.
          </div>
        </section>

        {/* Section 7: Raccourcis clavier */}
        <section className="user-guide-section">
          <div className="section-header-with-icon">
            <span className="section-icon">⌨️</span>
            <h4>7. Raccourcis clavier</h4>
          </div>
          <ul className="shortcuts-list">
            <li>
              <span className="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>Z</kbd></span>
              <span className="shortcut-desc">Annuler la dernière action</span>
            </li>
            <li>
              <span className="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>Y</kbd></span>
              <span className="shortcut-desc">Rétablir l'action annulée</span>
            </li>
             <li>
              <span className="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>C</kbd></span>
              <span className="shortcut-desc">Copier la sélection (formes, annotations, flèches)</span>
            </li>
            <li>
              <span className="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>V</kbd></span>
              <span className="shortcut-desc">Coller la sélection (avec décalage cumulatif)</span>
            </li>
            <li>
              <span className="shortcut-keys"><kbd>Suppr</kbd> / <kbd>Backspace</kbd></span>
              <span className="shortcut-desc">Supprimer l'élément sélectionné</span>
            </li>
          </ul>
        </section>

        {/* Section 8: Sauvegarde, Export et Import */}
        <section className="user-guide-section">
          <div className="section-header-with-icon">
            <span className="section-icon">💾</span>
            <h4>8. Import, Export & Sauvegarde</h4>
          </div>
          <p>
            Utilisez les boutons de la barre supérieure :
          </p>
          <ul className="actions-guide-list">
            <li>
              <strong>Auto-layout</strong> : Réorganise tout le canvas selon la direction active (<code>TD</code>, <code>LR</code>, <code>BT</code> ou <code>RL</code>). Les annotations textuelles et les flèches détachées restent présentes, suivent l'élément le plus proche et sont décalées en cas de chevauchement. L'action peut être annulée avec <strong>Ctrl+Z</strong>.
            </li>
            <li>
              <strong>Export .s2m</strong> : Télécharge un fichier projet <code>.s2m</code> local contenant tout votre diagramme (formes, liens, styles et positions).
            </li>
            <li>
              <strong>Import .s2m</strong> : Charge un fichier projet <code>.s2m</code> pour reprendre votre travail.
            </li>
            <li>
              <strong>Import Mermaid</strong> : Collez du code flowchart Mermaid existant pour le convertir en diagramme éditable avec des liens courbes routés comme dans Mermaid.
            </li>
            <li>
              <strong>Export (panneau de droite)</strong> : Copiez le code Mermaid généré sous format Markdown, HTML ou brut, ou téléchargez l'image SVG générée.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default UserGuide;
