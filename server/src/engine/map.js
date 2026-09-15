export class Map {
    constructor(map) {
        this.map = map;
    }

    breakWall(x, y) {
        if (this.map[y][x] === "breakable_wall") {
            this.map[y][x] = "ground";
            return true;
        }

        return false;
    }


    explosion(x, y, size) {
        const directions = [
            [1, 0],  // droite
            [-1, 0], // gauche
            [0, 1],  // bas
            [0, -1]  // haut
        ];

        for (const [dx, dy] of directions) {
            for (let distance = 1; distance <= size; distance++) {
                const newX = x + dx * distance;
                const newY = y + dy * distance;

                const cell = this.map[newY]?.[newX];

                if (cell === "wall") {
                    break;
                }

                if (cell === "breakable_wall") {
                    this.map[newY][newX] = "ground";
                    break;
                }
            }
        }
    }

    get(x, y) {
        return this.map[y][x];
    }
}