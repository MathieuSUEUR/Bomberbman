import { CellType } from '@bomberman/shared';
import { Map as GameMap } from './Map.js';
import { DEFAULT_GAME_CONFIG } from '@bomberman/shared';

/** Largeur standard de la grille en nombre de cases. */
const WIDTH = DEFAULT_GAME_CONFIG.gridWidth;

/** Hauteur standard de la grille en nombre de cases. */
const HEIGHT = DEFAULT_GAME_CONFIG.gridHeight;

/**
 * Génère un nombre entier pseudo-aléatoire compris entre `min` et `max` inclus.
 *
 * @param min - Borne inférieure (incluse).
 * @param max - Borne supérieure (incluse).
 * @returns Entier pseudo-aléatoire généré.
 */
function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Mélange aléatoirement les éléments d'un tableau (copie superficielle)
 * en utilisant l'algorithme de mélange de Fisher-Yates.
 *
 * @template T Type des éléments du tableau.
 * @param array - Tableau source à mélanger.
 * @returns Nouveau tableau contenant les mêmes éléments mélangés.
 */
function shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Détermine si une coordonnée appartient à une zone de sécurité d'un coin (spawn joueur).
 * Ces 3 cases par coin (12 au total) doivent rester vides de tout mur destructible
 * afin d'assurer que les joueurs puissent se déplacer à l'apparition.
 *
 * @param x - Coordonnée X sur la grille.
 * @param y - Coordonnée Y sur la grille.
 * @returns `true` si la case se situe sur un emplacement de spawn réservé, sinon `false`.
 */
function isSafeCornerCell(x: number, y: number): boolean {
    const corners = [
        [1, 1], [2, 1], [1, 2],
        [WIDTH - 2, 1], [WIDTH - 3, 1], [WIDTH - 2, 2],
        [1, HEIGHT - 2], [2, HEIGHT - 2], [1, HEIGHT - 3],
        [WIDTH - 2, HEIGHT - 2], [WIDTH - 3, HEIGHT - 2], [WIDTH - 2, HEIGHT - 3],
    ];
    return corners.some(([cx, cy]) => cx === x && cy === y);
}

/**
 * Génère une grille procédurale brute de 15x13 cases selon les règles classiques de Bomberman :
 * 1. Bordures et piliers internes périodiques indestructibles.
 * 2. Murs destructibles partout ailleurs, à l'exception des zones de départ (coins).
 * 3. Remplacement aléatoire de 2 à 4 piliers internes pour varier les chemins.
 * 4. Évidement aléatoire de 4 à 6 murs destructibles supplémentaires.
 *
 * @returns Grille 2D de cases (matrice `HEIGHT` x `WIDTH`).
 */
export function generateGrid(): CellType[][] {
    // Initialisation d'une grille vide
    const grid: CellType[][] = Array.from({ length: HEIGHT }, () =>
        Array(WIDTH).fill(CellType.EMPTY)
    );

    // Placement des bordures et piliers indestructibles
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            const isBorder = x === 0 || x === WIDTH - 1 || y === 0 || y === HEIGHT - 1;
            const isInternalPillar = x % 2 === 0 && y % 2 === 0;

            if (isBorder || isInternalPillar) {
                grid[y][x] = CellType.INDESTRUCTIBLE_WALL;
            }
        }
    }

    // Remplissage avec des murs destructibles hors zones de spawn
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            if (
                grid[y][x] === CellType.EMPTY &&
                !isSafeCornerCell(x, y)
            ) {
                grid[y][x] = CellType.DESTRUCTIBLE_WALL;
            }
        }
    }

    // Identification des piliers internes modifiables
    const internalPillars: [number, number][] = [];
    for (let y = 2; y < HEIGHT - 1; y += 2) {
        for (let x = 2; x < WIDTH - 1; x += 2) {
            internalPillars.push([x, y]);
        }
    }

    // Remplacement aléatoire de piliers par des murs destructibles
    const pillarsToReplace = shuffle(internalPillars).slice(0, randomInt(2, 4));
    for (const [x, y] of pillarsToReplace) {
        grid[y][x] = CellType.DESTRUCTIBLE_WALL;
    }

    // Identification des murs destructibles pour aération
    const destructibleCells: [number, number][] = [];
    for (let y = 1; y < HEIGHT - 1; y++) {
        for (let x = 1; x < WIDTH - 1; x++) {
            if (grid[y][x] === CellType.DESTRUCTIBLE_WALL) {
                destructibleCells.push([x, y]);
            }
        }
    }

    // Évidement aléatoire de certaines cases
    const cellsToEmpty = shuffle(destructibleCells).slice(0, randomInt(4, 6));
    for (const [x, y] of cellsToEmpty) {
        grid[y][x] = CellType.EMPTY;
    }

    return grid;
}

/**
 * Génère une nouvelle instance de `GameMap` contenant une grille procédurale.
 *
 * @returns Instance de carte prête pour une partie.
 */
export function generateMap(): GameMap {
    return new GameMap(generateGrid());
}

/**
 * Affiche une représentation textuelle (ASCII) de la grille dans les logs.
 *
 * Légende :
 * - `.` : Case vide
 * - `#` : Mur indestructible
 * - `X` : Mur destructible
 *
 * @param grid - Grille à afficher.
 */
export function debugMap(grid: CellType[][]): void {
    const symbols: Record<CellType, string> = {
        [CellType.EMPTY]: '.',
        [CellType.INDESTRUCTIBLE_WALL]: '#',
        [CellType.DESTRUCTIBLE_WALL]: 'X',
    };

    console.info('Map:');
    for (const row of grid) {
        console.info(row.map(cell => symbols[cell]).join(' '));
    }
}