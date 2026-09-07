//Ce code sert a instancier le serveur, ecouter les connections et les 
//interactions entre client et le serveur

//---DEPENDENCES---

//initialisation du serveur
import { WebSocketServer, WebSocket } from 'ws'; // Biblio externe pour WebSocket


const port= 8080;
const wws = new WebSocketServer({port, host: '127.0.0.1' });
console.log(`Serveur démarré sur le port ${port}`);


const clients: Set<WebSocket> = new Set();//pour stocker les clients dans une liste
//de web socket


//ecoute des connections
wws.on('connection',(ws: WebSocket) => {

    //connection
    console.log("Connection d'un client");
    clients.add(ws);


    //ecoute message/input
    ws.on('message', (message: Buffer) => {
        try{
            const messageParsee = JSON.parse(message.toString());
            console.log('Client input :', messageParsee);
        }
        catch(e){
            console.error('Erreur dans le parsing JSON');
        }
    });


    //deco
    ws.on('close',()=>{
        console.log('Client déconnecté');
        clients.delete(ws);
        //retirer le joueur du jeu
    });


});

setInterval(() => {

    if(clients.size === 0) return;

    const gameState = {
        type: 'GAME_TICK',
        payload: {
            timestamp: Date.now(),
            //faudra ajouter les autres données en jeu comme players
        }
    };

    const gameData = JSON.stringify(gameState);

    clients.forEach((client) => {
        if(client.readyState === WebSocket.OPEN){
            client.send(gameData);
        }
    });

},50);//boucle toutes les 50ms

//npm start en terminal pour lancer le serveur
//wscat -c ws://127.0.0.1:8080 dans un autre terminal pour tester la connection