# Roadmap serveur Bomberman

## État actuel

Le serveur contient déjà les briques principales du moteur de jeu :

- une carte générée de façon procédurale
- un moteur de jeu avec tick et état global
- un gestionnaire de bombes avec explosions et éliminations
- une couche réseau WebSocket avec lobby et start de partie
- des règles de plateau partagées via le package `shared`

## Ce qui est déjà couvert par les tests

Les tests existants et ajoutés couvrent :

- l'état initial du moteur
- l'incrémentation du tick
- l'ajout d'actions dans la file
- les positions de spawn calculées depuis la configuration partagée
- les zones de sécurité des coins
- la génération de la grille
- les bordures indestructibles
- le placement d'une bombe
- le déclenchement d'une explosion
- la destruction d'un mur destructible
- l'élimination d'un joueur touché par le souffle

## Ce qu'il reste à faire concrètement

### 1. Implémenter le traitement des actions du moteur
Le point principal reste la logique de `processActions()` dans [server/src/engine/GameEngine.ts](../server/src/engine/GameEngine.ts).

Il faut :

- gérer `MOVE_UP`, `MOVE_DOWN`, `MOVE_LEFT`, `MOVE_RIGHT`
- vérifier les collisions avec les murs et les cases non traversables
- mettre à jour la position des joueurs
- gérer `PLACE_BOMB` avec la limite de bombes
- protéger les zones de spawn lors des mouvements

### 2. Relier les actions réseau au moteur
Le flux actuel est partiellement branché, mais il manque encore :

- transmission fiable des actions validées
- mise à jour d'un `GameState` complet après chaque tick
- diffusion du jeu aux clients via `GAME_STATE`

### 3. Compléter la diffusion côté WebSocket
Dans [server/src/network/SocketManager.ts](../server/src/network/SocketManager.ts), il manque notamment :

- envoyer `GAME_STATE` à chaque tick quand la partie est active
- envoyer `BOMB_EXPLODED` quand une bombe explose
- envoyer `PLAYER_ELIMINATED` et `GAME_OVER` lors des éliminations
- gérer les cas de fin de partie

### 4. Finir la logique métier de l'état de partie
Le moteur doit encore bien définir :

- quand la partie passe en `IN_PROGRESS`
- comment on vérifie la victoire
- quand l'état `FINISHED` est atteint
- comment gérer les joueurs morts et le reset de partie

### 5. Ajouter des tests sur le réseau et le flux complet
Les tests actuels sont déjà une bonne base, mais il manque encore :

- tests de `SocketManager`
- tests du lobby et du start de partie
- tests de flux complet : join → ready → start → tick → explosion

## Priorité recommandée

1. Implémenter `processActions()` dans le moteur
2. Diffuser `GAME_STATE` à chaque tick
3. Tester les explosions et les mouvements
4. Gérer les fins de partie et les messages réseau
5. Ajouter les tests d'intégration de bout en bout

## Conclusion

Le serveur a déjà une base solide, mais le cœur du jeu n'est pas encore complètement relié entre les actions, la logique de plateau et la diffusion réseau. La prochaine étape la plus importante est de terminer la gestion des actions du moteur puis de valider le flux complet avec des tests d'intégration.
