# GeoApex — Ultimate 3D GeoGuessr Clone with Cloud SQL & Firebase

> **Clone GeoGuessr compétitif en temps réel** avec exploration Street View 360°, flèches de déplacement interactives, duels multijoueurs, carte Leaflet haute définition, globe 3D Three.js, base de données relationnelle Cloud SQL (PostgreSQL) et authentification Firebase.

---

## 🌟 Fonctionnalités Clés

- **Navigation & Déplacement 360° ("Avancer dans le monde")** :
  - Flèches interactives de déplacement à l'écran (Avancer `[▲]`, Reculer `[▼]`, Pivoter `[◄]` `[►]`).
  - Déplacement au clavier : touches fléchées ou `ZQSD` / `WASD`.
  - Liens Street View automatiques et interpolation géodésique.
  - Boutons Boussole Nord (`N`), Retour au départ (`R`), et Téléportation Aléatoire (`T`).

- **Carte du Monde Haute Définition (style OpenGuessr)** :
  - Tuiles Leaflet détaillées (OpenStreetMap / Esri Relief / Satellite) sans quotas ni clés requises pour le joueur.
  - Épingle rouge OpenGuessr personnalisée avec glisser-déposer.
  - Bouton rouge géant `DEVINER [Espace]`.
  - Écran de résultat avec tracé pointillé entre le lieu réel (drapeau 🏁) et votre repère (📍).

- **Modes de Jeu Compétitifs** :
  - **Duel 1v1** : Barre de 6 000 PV, multiplicateurs de dégâts progressifs (x1.0 à x3.0), bots intelligents avec temps de réaction réalistes ou salons multijoueurs en direct.
  - **Classique (Tour du Monde)** : 5 rounds, 25 000 points maximum.
  - **Country Streak** : Série de pays consécutifs sans faute avec sélecteur de drapeaux.
  - **Blitz 30s** : Chronomètre de 30 secondes pour les réflexes ultimes.

- **Persistance Cloud SQL (PostgreSQL) & Firebase Auth** :
  - Base PostgreSQL managée sur Google Cloud SQL (`yogic-craft-0mvz5`, région `europe-west2`).
  - Drizzle ORM avec schéma type-safe (`users`, `game_scores`).
  - Authentification Google via Firebase Auth et synchronisation automatique des profils.
  - Classement mondial en direct.

---

## 🚀 Pousser sur GitHub

Pour lier ce projet à votre compte GitHub :

1. Créez un nouveau dépôt sur [github.com/new](https://github.com/new) (par exemple `geoapex`).
2. Exécutez les commandes suivantes dans votre terminal :

```bash
git init
git add .
git commit -m "feat: GeoApex 3D GeoGuessr with Cloud SQL and Firebase"
git branch -M main
git remote add origin https://github.com/VOTRE_PSEUDO/geoapex.git
git push -u origin main
```

---

## 🛠️ Stack Technique

- **Frontend** : React 19, TypeScript, Tailwind CSS, Three.js, Leaflet, Motion, Lucide Icons, Canvas-Confetti.
- **Backend** : Node.js, Express, tsx.
- **Base de données** : PostgreSQL sur Google Cloud SQL via Drizzle ORM et `pg` connection pool.
- **Authentification** : Firebase Authentication (Client SDK & Firebase Admin SDK).
- **Cartographie** : Google Maps Platform (Street View Panorama), OpenStreetMap, CartoDB.
