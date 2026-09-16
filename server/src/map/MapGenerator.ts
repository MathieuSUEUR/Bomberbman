import { CellType } from '@bomberman/shared';
import { Map as GameMap } from './Map.js';

const WIDTH = 15;
const HEIGHT = 13;

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function isSafeCornerCell(x: number, y: number): boolean {
    const corners = [
        [1, 1], [2, 1], [1, 2],
        [WIDTH - 2, 1], [WIDTH - 3, 1], [WIDTH - 2, 2],
        [1, HEIGHT - 2], [2, HEIGHT - 2], [1, HEIGHT - 3],
        [WIDTH - 2, HEIGHT - 2], [WIDTH - 3, HEIGHT - 2], [WIDTH - 2, HEIGHT - 3],
    ];
    return corners.some(([cx, cy]) => cx === x && cy === y);
}

export function generateGrid(): CellType[][] {
    const grid: CellType[][] = Array.from({ length: HEIGHT }, () =>
        Array(WIDTH).fill(CellType.EMPTY)
    );

    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            const isBorder = x === 0 || x === WIDTH - 1 || y === 0 || y === HEIGHT - 1;
            const isInternalPillar = x % 2 === 0 && y % 2 === 0;

            if (isBorder || isInternalPillar) {
                grid[y][x] = CellType.INDESTRUCTIBLE_WALL;
            }
        }
    }

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

    const internalPillars: [number, number][] = [];
    for (let y = 2; y < HEIGHT - 1; y += 2) {
        for (let x = 2; x < WIDTH - 1; x += 2) {
            internalPillars.push([x, y]);
        }
    }

    const pillarsToReplace = shuffle(internalPillars).slice(0, randomInt(2, 4));
    for (const [x, y] of pillarsToReplace) {
        grid[y][x] = CellType.DESTRUCTIBLE_WALL;
    }

    const destructibleCells: [number, number][] = [];
    for (let y = 1; y < HEIGHT - 1; y++) {
        for (let x = 1; x < WIDTH - 1; x++) {
            if (grid[y][x] === CellType.DESTRUCTIBLE_WALL) {
                destructibleCells.push([x, y]);
            }
        }
    }

    const cellsToEmpty = shuffle(destructibleCells).slice(0, randomInt(4, 6));
    for (const [x, y] of cellsToEmpty) {
        grid[y][x] = CellType.EMPTY;
    }

    return grid;
}

export function generateMap(): GameMap {
    return new GameMap(generateGrid());
}

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