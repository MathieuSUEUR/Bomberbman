export const CellType = Object.freeze({
    EMPTY: 0,
    INDESTRUCTIBLE_WALL: 1,
    DESTRUCTIBLE_WALL: 2
} as const);

export type CellType = typeof CellType[keyof typeof CellType];