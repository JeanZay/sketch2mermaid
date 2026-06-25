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
            Pour créer des flèches, glissez un lien depuis l'un des points d'ancrage (les petits cercles de couleur jaune/bleu) d'un nœud vers un autre nœud.
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

        {/* Section 5: Annotations */}
        <section className="user-guide-section">
          <div className="section-header-with-icon">
            <span className="section-icon">📝</span>
            <h4>5. Annotations textuelles</h4>
          </div>
          <p>
            Ajoutez des annotations libres grâce au bouton <strong>Text</strong> dans la section <i>Annotations</i> du panneau de gauche.
          </p>
          <div className="guide-note">
            ⚠️ Les annotations textuelles sont purement visuelles et ne sont pas incluses dans le code Mermaid exporté.
          </div>
        </section>

        {/* Section 6: Raccourcis clavier */}
        <section className="user-guide-section">
          <div className="section-header-with-icon">
            <span className="section-icon">⌨️</span>
            <h4>6. Raccourcis clavier</h4>
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
              <span className="shortcut-keys"><kbd>Suppr</kbd> / <kbd>Backspace</kbd></span>
              <span className="shortcut-desc">Supprimer l'élément sélectionné</span>
            </li>
          </ul>
        </section>

        {/* Section 7: Sauvegarde, Export et Import */}
        <section className="user-guide-section">
          <div className="section-header-with-icon">
            <span className="section-icon">💾</span>
            <h4>7. Import, Export & Sauvegarde</h4>
          </div>
          <p>
            Utilisez les boutons de la barre supérieure :
          </p>
          <ul className="actions-guide-list">
            <li>
              <strong>Export .s2m</strong> : Télécharge un fichier projet <code>.s2m</code> local contenant tout votre diagramme (formes, liens, styles et positions).
            </li>
            <li>
              <strong>Import .s2m</strong> : Charge un fichier projet <code>.s2m</code> pour reprendre votre travail.
            </li>
            <li>
              <strong>Import Mermaid</strong> : Collez du code flowchart Mermaid existant pour le convertir instantanément en diagramme éditable sur le canvas.
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
