# Protocole WebSocket - Bomberman Arena

Ce document technique détaille le format des messages JSON échangés en temps réel entre le Client et le Serveur via WebSockets.

## 1. Client ➔ Serveur (Intentions du joueur)
Le client agit comme un terminal muet : il transmet les entrées de l'utilisateur sans effectuer le moindre calcul de collision.

*   **Déplacement :** Le joueur tente d'avancer dans une direction.
    `{ "type": "MOVE", "payload": { "direction": "UP" } }` // Valeurs possibles: UP, DOWN, LEFT, RIGHT
*   **Action :** Le joueur tente de poser une bombe sur sa case actuelle.
    `{ "type": "PLACE_BOMB", "payload": {} }`

## 2. Serveur ➔ Client (Vérité Absolue)
Le serveur est le seul maître du moteur de jeu. Il diffuse l'état global que le client doit interpréter pour le rendu graphique.

*   **Synchronisation d'état :** Diffusé pour mettre à jour la position des joueurs et l'état des murs.
    `{ "type": "GAME_STATE", "payload": { "players": [{"id": "p1", "x": 2, "y": 3, "isDead": false}], "grid": [[1,0,1], [0,0,0]] } }`
*   **Événement d'explosion :** Indique au client quelles cases spécifiques doivent afficher l'animation de flammes.
    `{ "type": "EXPLOSION", "payload": { "cells": [{"x": 2, "y": 3}, {"x": 2, "y": 4}] } }`