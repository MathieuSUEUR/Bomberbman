import { CellType } from "../../../shared/src/CellType.js";

export class Map {
    constructor(grid) {
        this.grid = grid;
    }

    get(x, y) {
        return this.grid[y]?.[x];
    }

    explosion(x, y, size) {
        const directions = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 }
        ];

        for (const direction of directions) {
            for (let distance = 1; distance <= size; distance++) {
                const newX = x + direction.x * distance;
                const newY = y + direction.y * distance;

                const cellType = this.get(newX, newY);

                if (cellType === undefined) {
                    break;
                }

                if (cellType === CellType.INDESTRUCTIBLE_WALL) {
                    break;
                }

                if (cellType === CellType.DESTRUCTIBLE_WALL) {
                    this.grid[newY][newX] = CellType.EMPTY;
                    break;
                }
            }
        }
    }
}