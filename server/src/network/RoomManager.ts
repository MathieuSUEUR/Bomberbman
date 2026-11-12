import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { RoomSummary } from '@bomberman/shared';
import { Room } from './Room.js';
import { GameEngine } from '../engine/GameEngine.js';

export interface CreateRoomOptions {
    id?: string;
    name?: string;
    engine?: GameEngine;
    isPermanent?: boolean;
    maxPlayers?: number;
}

export interface JoinRoomResult {
    success: boolean;
    room?: Room;
    reason?: string;
}

/**
 * Gère le cycle de vie de multiples salles de jeu (Rooms),
 * l'assignation des joueurs aux salles et l'isolation des parties.
 */
export class RoomManager {
    private rooms: Map<string, Room> = new Map();
    private clientRoomMap: Map<string, string> = new Map();

    /**
     * Crée une nouvelle salle de jeu avec des options spécifiques.
     */
    public createRoom(options?: CreateRoomOptions): Room {
        const id = options?.id || `ROOM-${randomUUID().slice(0, 4).toUpperCase()}`;
        const name = options?.name || (id === 'default' ? 'Salon Principal' : `Salon ${id}`);
        const room = new Room(
            id,
            name,
            options?.engine,
            options?.isPermanent ?? false,
            options?.maxPlayers ?? 4
        );
        this.rooms.set(id, room);
        console.info(`RoomManager: Room created [${id}] "${name}"`);
        return room;
    }

    /**
     * Récupère une salle existante ou la crée si elle n'existe pas encore.
     */
    public getOrCreateRoom(
        roomId?: string,
        name?: string,
        engine?: GameEngine,
        isPermanent: boolean = false
    ): Room {
        const targetId = roomId && roomId.trim().length > 0 ? roomId.trim() : 'default';
        let room = this.rooms.get(targetId);
        if (!room) {
            room = this.createRoom({
                id: targetId,
                name: name || (targetId === 'default' ? 'Salon Principal' : `Salon ${targetId}`),
                engine,
                isPermanent: targetId === 'default' ? true : isPermanent
            });
        }
        return room;
    }

    /**
     * Ajoute un joueur dans une salle désignée (ou 'default' par défaut).
     */
    public joinRoom(
        clientId: string,
        ws: WebSocket,
        playerName: string,
        roomId?: string
    ): JoinRoomResult {
        // Si le joueur était déjà dans une autre salle, il la quitte
        if (this.clientRoomMap.has(clientId)) {
            this.leaveRoom(clientId);
        }

        const room = this.getOrCreateRoom(roomId);
        if (!room.canJoin()) {
            const isFull = room.getLobbyPlayers().length >= room.maxPlayers;
            return {
                success: false,
                reason: isFull ? 'La salle est complète.' : 'La partie est déjà en cours dans cette salle.'
            };
        }

        const joined = room.addPlayer(clientId, ws, playerName);
        if (joined) {
            this.clientRoomMap.set(clientId, room.id);
            return { success: true, room };
        }

        return {
            success: false,
            reason: 'Impossible de rejoindre la salle.'
        };
    }

    /**
     * Fait quitter sa salle actuelle à un joueur. Supprime automatiquement la salle si elle devient vide
     * et n'est pas marquée comme permanente.
     */
    public leaveRoom(clientId: string): Room | undefined {
        const roomId = this.clientRoomMap.get(clientId);
        if (!roomId) {
            return undefined;
        }

        this.clientRoomMap.delete(clientId);
        const room = this.rooms.get(roomId);
        if (room) {
            room.removePlayer(clientId);
            if (room.isEmpty() && !room.isPermanent) {
                room.destroy();
                this.rooms.delete(roomId);
                console.info(`RoomManager: Room [${roomId}] deleted because it became empty.`);
            }
            return room;
        }

        return undefined;
    }

    /**
     * Retourne la salle à laquelle appartient un client.
     */
    public getRoomByClientId(clientId: string): Room | undefined {
        const roomId = this.clientRoomMap.get(clientId);
        if (!roomId) {
            return undefined;
        }
        return this.rooms.get(roomId);
    }

    /**
     * Retourne une salle par son ID.
     */
    public getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    /**
     * Retourne la salle par défaut.
     */
    public getDefaultRoom(): Room | undefined {
        return this.rooms.get('default');
    }

    /**
     * Liste toutes les salles actuellement actives avec leurs métadonnées publiques.
     */
    public listRooms(): RoomSummary[] {
        return Array.from(this.rooms.values()).map(r => r.getSummary());
    }

    /**
     * Détruit toutes les salles et réinitialise le gestionnaire.
     */
    public destroyAll(): void {
        for (const room of this.rooms.values()) {
            room.destroy();
        }
        this.rooms.clear();
        this.clientRoomMap.clear();
    }
}

