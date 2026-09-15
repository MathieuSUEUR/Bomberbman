## Description

Cette PR met en place les fichiers de gouvernance initiaux pour le dépôt. Elle ajoute le fichier CODEOWNERS afin d'imposer la validation par le pôle DevOps sur les répertoires sensibles (/server/ et /.github/). Elle introduit également ce template de Pull Request pour automatiser l'affichage de la checklist de qualité.

## Type de changement

- [ ] feat (nouvelle fonctionnalité)
- [ ] fix (correction de bug)
- [x] chore (maintenance, dépendances)
- [ ] docs (documentation)
- [ ] refactor (sans changement de comportement)

## Checklist qualité

- [ ] Le code build sans erreur (`npm run build`)
- [ ] Le lint passe (`npm run lint`)
- [ ] Des tests ont été ajoutés ou mis à jour si nécessaire
- [ ] Tous les tests passent en local (`npm test`)
- [x] La documentation a été mise à jour si nécessaire (README, protocole WebSocket, etc.)
- [x] Aucun `console.log` ou code de debug oublié
- [x] La PR cible bien `develop` (jamais `main` directement)

## Comment tester



1. Lire les modifications dans l'onglet "Files changed" pour s'assurer que les deux fichiers sont présents dans le dossier /.github/.
2. Vérifier que les chemins /server/ et /.github/ sont correctement assignés à @MathieuSUEUR et @AlexisPonceyValdemar dans le fichier CODEOWNERS.
3. Après la fusion de cette PR dans develop, simuler l'ouverture d'une nouvelle PR pour vérifier que ce template s'affiche automatiquement par défaut.

## Issues liées

Closes #