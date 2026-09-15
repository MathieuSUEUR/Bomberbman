# Bomberman Arena - Guide de Demarrage

Projet universitaire realise dans le cadre du **BUT 3 Informatique - Qualite de Developpement (UPJV)**.

---

## Presentation du Projet

**Bomberman Arena** est un jeu multijoueur en temps reel base sur une architecture Client-Serveur stricte :
- **Serveur (Backend)** : Moteur de jeu autoritaire sous Node.js avec synchronisation WebSocket.
- **Client (Frontend)** : Application de bureau hybride (Electron + Vite + TypeScript & PixiJS).
- **Shared** : Contrats de messages JSON et types TypeScript partages.

Le projet est gere sous la forme d'un **Monorepo** avec les **npm workspaces**.

---

## Prerequis

- **Node.js** : version `20.0.0` ou superieure (teste sous Node v22+)
- **npm** : version `10.0.0` ou superieure
- **Git**

---

## Demarrage Rapide

### 1. Cloner le projet et se positionner sur la branche de travail

```bash
git clone <URL_DU_REPO>
cd Bomberbman

# Travailler sur la branche d'integration
git checkout develop

# Creer votre branche de fonctionnalite (regle GitFlow)
git checkout -b feature/nom-de-votre-tache
```

### 2. Installer les dependances

A la racine du projet (installe automatiquement les dependances de tous les packages `shared`, `server`, `client`) :

```bash
npm install
```

---

## Commandes Disponibles

Toutes les commandes se lancent depuis la **racine** du monorepo :

| Commande | Description |
| :--- | :--- |
| `npm run dev` | Lance le serveur et le client en simultane avec rechargement a chaud |
| `npm run dev:server` | Lance uniquement le serveur en mode developpement (surveille `src/index.ts`) |
| `npm run dev:client` | Lance uniquement le client web/desktop Vite |
| `npm run build` | Compile l'ensemble des packages (`shared`, `server`, `client`) |
| `npm run lint` | Lance l'analyse statique du code (ESLint) |
| `npm run format` | Formate automatiquement tous les fichiers du projet (Prettier) |
| `npm run format:check` | Verifie le formatage sans le modifier |
| `npm test` | Execute la suite de tests automatises (Vitest) |

---

## Structure du Monorepo

```text
Bomberbman/
├── .github/
│   └── workflows/
│       └── ci.yml               # Pipeline CI GitHub Actions (Lint, Build, Test)
├── client/                      # Pole Frontend (Electron + Vite + PixiJS)
│   ├── electron/                # Processus principal Electron (fenetre desktop)
│   ├── src/                     # Code source client (IHM, entrees, rendu)
│   ├── index.html               # Point d'entree HTML
│   └── package.json
├── server/                      # Pole Backend (Node.js + WebSockets)
│   ├── src/                     # Code source serveur (Game engine, boucle de jeu)
│   └── package.json
├── shared/                      # Contrats partages (Client & Serveur)
│   ├── src/                     # Types TypeScript, constantes, protocole JSON
│   └── package.json
├── docs/                        # Documentation d'architecture et de conception
│   ├── architecture.md
│   ├── gitflow.md
│   └── websocket-protocol.md
├── package.json                 # Configuration racine des npm workspaces
└── tsconfig.base.json           # Options TypeScript partagees
```

---

## Organisation par Poles

Selon les consignes du sujet d'evaluation :

### 1. Pole Backend / Serveur
- Developper la logique du jeu dans `server/src/` (gestion des salles, collisions, grilles, explosions).
- Gerer les connexions WebSockets et la diffusion des etats de jeu aux clients.
- S'assurer que le serveur reste **autoritaire** (le client ne valide aucune action de gameplay).
- Ecrire des tests unitaires pour la logique metier.

### 2. Pole Frontend / Client
- Developper l'interface et le rendu graphique dans `client/src/` (PixiJS / Canvas 2D).
- Gerer la capture des entrees clavier (ZQSD / Fleches, Espace pour poser une bombe).
- **Contrainte Qualite** : Decoupler strictement la couche reseau du moteur graphique (ex: via un bus d'evenements interne).
- **Mocking** : Prevoir la possibilite de tester l'interface hors-ligne avec des donnees simulees.

### 3. Pole DevOps & Qualite
- Maintenir la configuration du pipeline CI (`.github/workflows/ci.yml`).
- Veiller au respect de **GitFlow** et a la proprete des Pull Requests.
- Rediger la documentation technique dans le dossier `docs/`.

---

## Regles GitFlow & Bonnes Pratiques

1. **Branches principales** :
   - `main` : code de production uniquement (stable).
   - `develop` : branche d'integration active.
2. **Branches de travail** :
   - Creez toujours votre branche depuis `develop` : `git checkout -b feature/ma-fonctionnalite develop`.
   - **Interdiction formelle de pousser (`push`) directement sur `main` ou `develop`**.
3. **Pull Requests (PR)** :
   - Chaque fonctionnalite doit faire l'objet d'une PR vers `develop`.
   - Chaque PR necessite l'approbation d'au moins **2 pairs** (dont un membre Qualite/DevOps).
   - La CI (Build + Lint + Tests) doit etre au **vert** avant toute fusion.
4. **Commits** :
   - Rediger des messages clairs et explicites, idealement prefixes (`feat:`, `fix:`, `docs:`, `test:`).
