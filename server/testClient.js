import WebSocket from 'ws';

const ws1 = new WebSocket('ws://localhost:8080');

ws1.on('open', () => {
    console.log('[Client 1] Connected');
});

ws1.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log(`[Client 1] Received:`, msg.type, msg.type === 'GAME_STATE' ? '(State skipped)' : msg.payload);
    
    if (msg.type === 'WELCOME') {
        ws1.send(JSON.stringify({
            type: 'JOIN',
            payload: { name: 'Player 1' }
        }));
    } else if (msg.type === 'LOBBY_STATE') {
        const canStart = msg.payload.canStart;
        if (!canStart && msg.payload.players.length === 1) {
            // Un deuxième client se connecte
            const ws2 = new WebSocket('ws://localhost:8080');
            ws2.on('open', () => console.log('[Client 2] Connected'));
            ws2.on('message', (d2) => {
                const m2 = JSON.parse(d2.toString());
                if (m2.type === 'WELCOME') {
                    ws2.send(JSON.stringify({ type: 'JOIN', payload: { name: 'Player 2' } }));
                } else if (m2.type === 'LOBBY_STATE' && m2.payload.players.length === 2) {
                    ws2.send(JSON.stringify({ type: 'READY', payload: { isReady: true } }));
                }
            });
        }
        
        const myPlayer = msg.payload.players.find(p => p.name === 'Player 1');
        if (myPlayer && !myPlayer.isReady && msg.payload.players.length === 2) {
            ws1.send(JSON.stringify({ type: 'READY', payload: { isReady: true } }));
        }
    } else if (msg.type === 'GAME_START') {
        console.log('[Client 1] Game starting... Sending ACTION');
        ws1.send(JSON.stringify({
            type: 'ACTION',
            payload: { actionType: 'MOVE_UP' }
        }));
        
        setTimeout(() => {
            console.log('Test successful. Exiting.');
            process.exit(0);
        }, 1000);
    }
});

ws1.on('error', console.error);
ws1.on('close', () => console.log('[Client 1] Disconnected'));
