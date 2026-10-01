# Roadmap serveur Bomberman

## État actuel

Le serveur dispose d'une architecture complète, stable et testée reliant le moteur de jeu, la gestion des règles, et la couche réseau WebSocket :

- **Carte procédurale & règles partagées** : génération de grille, bordures, zones de sécurité des spawns, configuration partagée via `@bomberman/shared`.
- **Moteur de jeu (`GameEngine`)** : boucle cadencée à 20 ticks/sec, état global (`GameState`), traitement des actions joueur (`MOVE_UP`, `MOVE_DOWN`, `MOVE_LEFT`, `MOVE_RIGHT`, `PLACE_BOMB`).
- **Gestion des bombes & déflagrations (`BombManager`)** : compte à rebours, portée, réactions en chaîne, destruction des murs, élimination des joueurs dans le souffle ou marchant sur des flammes actives.
- **Mort Subite (Sudden Death)** : chute de blocs indestructibles en spirale vers le centre après expiration du temps réglementaire avec écrasement des joueurs.
- **Fin de partie & Game Over** : détection automatique de la victoire (dernier survivant) ou du match nul (double K.O.), passage au statut `FINISHED`, arrêt de la boucle de jeu et émission de l'événement `gameOver`.
- **Couche réseau WebSocket (`SocketManager`)** : gestion des connexions, salon d'attente (Lobby), synchronisation des statuts prêts, diffusion en temps réel (`WELCOME`, `LOBBY_STATE`, `GAME_START`, `GAME_STATE`, `BOMB_EXPLODED`, `PLAYER_ELIMINATED`, `GAME_OVER`, `PONG`).

---

## Ce qui est validé par les tests (52 tests passants)

Les 6 suites de tests couvrent l'intégralité du cycle de vie du serveur :

- **Moteur & Actions joueur** (`GameEngineActions.test.ts` - 25 tests) :
  - Déplacements 4 directions, respect de la vitesse, collision murs/bombes/bordures.
  - Déplacement unique par joueur par tick.
  - Pose de bombes, limite `maxBombs`, interdiction sur case occupée ou par joueur éliminé.
  - Élimination immédiate lors d'un déplacement sur une explosion active.
- **Règles & Bombes** (`BombManager.test.ts` - 7 tests) :
  - Compte à rebours, portée, souffle, destruction des blocs destructibles, réactions en chaîne.
- **Génération de carte** (`MapGenerator.test.ts` & `GameEngine.test.ts` - 11 tests) :
  - Spawns, zones sécurisées, murs indestructibles, chute en spirale de la mort subite.
- **Fin de partie (Game Over)** (`GameEngine.test.ts`) :
  - Détection du gagnant unique, match nul (0 survivant), statut `FINISHED` et arrêt de la boucle.
- **Réseau WebSocket** (`SocketManager.test.ts` - 7 tests) :
  - Connexion client, attribution `playerId`, gestion des arrivées/départs du lobby, démarrage à 2 joueurs prêts, relais des actions et ping/pong.
- **Intégration de bout en bout** (`FullGameIntegration.test.ts` - 2 tests) :
  - Simulation d'une partie complète en temps réel : Connexion → Lobby → Prêt → Démarrage → Action/Pose de bombe → Explosion → Élimination → Diffusion WebSocket du `GAME_OVER` avec vainqueur.
  - Cas de match nul complet via WebSocket.

---

## Ce qu'il reste à faire concrètement

### 1. Mécanisme de Reset / Replay (Prochaine priorité)

Permettre d'enchaîner plusieurs parties d'affilée sans redémarrer le serveur :

- Implémenter une méthode `GameEngine.reset()` :
  - régénération d'une nouvelle carte vierge
  - remise à 0 du `tickCount` et de l'index de Mort Subite
  - nettoyage des bombes, explosions et joueurs
  - remise du statut à `WAITING`
- Côté `SocketManager` :
  - réinitialiser `isReady = false` pour tous les joueurs du lobby à la fin d'une partie
  - diffuser le nouveau `LOBBY_STATE` pour permettre de relancer un match

### 2. Système de Power-Ups / Bonus

Ajouter les objets à ramasser pour enrichir le gameplay :

- Apparition aléatoire de bonus lors de la destruction d'un mur destructible :
  - `BOMB_UP` : augmente le nombre maximal de bombes (`maxBombs`)
  - `FIRE_UP` : augmente la portée des explosions (`bombRange`)
  - `SPEED_UP` : augmente la vitesse de déplacement (`speed`)
- Détection du ramassage lors des déplacements des joueurs dans `processActions()`.
- Diffusion des bonus sur la grille dans le `GameState`.

### 3. Gestion des déconnexions en cours de partie

- Gérer le cas où un joueur quitte ou perd sa connexion WebSocket pendant une partie `IN_PROGRESS` :
  - passage de son état à `isAlive: false` (forfait)
  - vérification immédiate des conditions de victoire si un seul joueur reste connecté.

---

## Priorité recommandée pour la suite

1. **Replay / Reset** : finaliser le cycle de rejouabilité dans le lobby et le moteur.
2. **Power-ups** : génération sous les murs détruits et application des bonus aux joueurs.
3. **Résilience réseau** : gestion propre des abandons / déconnexions en plein match.
