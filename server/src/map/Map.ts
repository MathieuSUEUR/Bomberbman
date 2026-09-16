import {
    CellType
} from '@bomberman/shared';

export class Map {
    private grid: CellType[][];

    constructor(grid: CellType[][]) {
        this.grid = grid;
    }

    /**
     * méthode qui permet de recuperer le type d'une case
     * @param x coordonnée x
     * @param y coordonnée y
     * @returns CellType le type de la case
     */
    get(x: number, y: number): CellType | undefined {
        return this.grid[y]?.[x];
    }

    /**
     * méthode qui permet de recuperer la grille
     * @returns CellType[][] la grille
     */
    getGrid(): CellType[][] {
        return this.grid;
    }

    /**
     * méthode qui permet de modifier le type d'une case
     * @param x coordonnée x
     * @param y coordonnée y
     * @param type type de la case
     */
    setCell(x: number, y: number, type: CellType): void {
        if (this.grid[y]?.[x] !== undefined) {
            this.grid[y][x] = type;
        }
    }

}