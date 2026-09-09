//Ce code sert a instancier le serveur, ecouter les connections et les 
//interactions entre client et le serveur

//---DEPENDENCES---

//initialisation du serveur
import { WebSocketServer, WebSocket } from 'ws'; // Biblio externe pour WebSocket
import crypto from 'crypto';//gere les ID
import { MessageType, type GameMessage } from './src/protocol/message.js';


const port= 8080;
const wss = new WebSocketServer({port, host: '127.0.0.1' });
console.log(`Serveur démarré sur le port ${port}`);


const clients = new Map<WebSocket,{id:string, name: string}>();//pour stocker les clients dans une liste, map car associer WebSocket a données


//ecoute des connections
wss.on('connection',(ws: WebSocket) => {
    console.log("Connection établie");


    //ecoute message/input
    ws.on('message', (message: Buffer) => {
        try{

            const messageParsee:GameMessage = JSON.parse(message.toString());

            switch(messageParsee.type){

                //REJOINT LE SALON
                case MessageType.JOIN_LOBBY : {
                    const playerId = crypto.randomUUID();
                    const playerName = messageParsee.payload.playerName;

                    //enrengistre le joueur
                    clients.set(ws, { id:playerId, name:playerName});

                    console.log(`[LOBBY] ${playerName} a rejoint la partie, ID:${playerId}`);
                    console.log(`[LOBBY] Joeurs actuels : ${clients.size}/4`);

                    //reponse au client
                    const response: GameMessage = {
                        type: MessageType.PLAYER_JOINED,
                        payload: { playerId, playerName }
                    };
                    ws.send(JSON.stringify(response));
                    break;
                }

                //GESTION DE LA PARTIE (pas fait)

                //DEPLACEMENT 
                case MessageType.MOVE: {
                    const playerData = clients.get(ws);
                    if (!playerData) return; //joueur n'est pas dans le lobby
                    console.log(`[MOVE] Le joueur ${playerData.name} veut aller en : ${messageParsee.payload.direction}`);
                    break;
                }



                default:
                    console.log(`Message non géré : ${messageParsee.type}`);
            }

        }
        catch(e){
            console.error('Erreur dans le parsing JSON/Format');
        }
    });


    //deco
    ws.on('close',()=>{
        const playerData = clients.get(ws);
        if (playerData) {
            console.log(`[LOBBY] ${playerData.name} s'est déconnecté.`);
            clients.delete(ws);
            
            //faudra envoyer un MessageType.PLAYER_LEFT aux autres joueurs
        } else {
            console.log("Connexion non identifiée fermée.");
        }
    });


});

setInterval(() => {

    if(clients.size === 0) return;

    const gameState: GameMessage = {
        type: MessageType.GAME_TICK,
        payload: {
            timestamp: Date.now(),
            //faudra ajouter les autres données en jeu comme players
        }
    };

    const gameData = JSON.stringify(gameState);

    for (const clientWs of clients.keys()) {
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(gameData);
        }
    }

},20);//boucle toutes les 20ms

//npm start en terminal pour lancer le serveur
//wscat -c ws://127.0.0.1:8080 dans un autre terminal pour tester la connection