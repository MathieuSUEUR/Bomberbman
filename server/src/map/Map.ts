import {
    CellType
} from '@bomberman/shared';

export class Map {
    private grid: CellType[][];

    constructor(grid: CellType[][]) {
        this.grid = grid;
    }

    get(x: number, y: number): CellType | undefined {
        return this.grid[y]?.[x];
    }

    getGrid(): CellType[][] {
        return this.grid;
    }

    setCell(x: number, y: number, type: CellType): void {
        if (this.grid[y]?.[x] !== undefined) {
            this.grid[y][x] = type;
        }
    }

}