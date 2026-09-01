import { WebSocketServer } from 'ws';
// The Phone Call Model

const wsServer = new WebSocketServer({ port: 8080 });
// const internalClientMap = new Map();
const clients = new Map();
const clientsReverseMap = new Map();

wsServer.on('connection', (ws, request) => {

    // const clientId = crypto.randomUUID();
    console.log('signaling server client connected');
    // internalClientMap.set(ws, clientId);

    ws.on('message', (message) => {
        const parsedMessage = JSON.parse(message);
        console.log('signaling server received message:', parsedMessage);

        if (parsedMessage.type === 'register') {
            clients.set(parsedMessage.id, ws);
            clientsReverseMap.set(ws, parsedMessage.id);
            console.log(`Client ${parsedMessage.id} connected from ${request.socket.remoteAddress}`);
        } else {
            if (!clients.has(parsedMessage.to)) {
                clients.get(parsedMessage.from).send(JSON.stringify({ type: 'wsserror', message: 'recipient not connected/registered to the server' }));
                return;
            } else {
                clients.get(parsedMessage.to).send(JSON.stringify(parsedMessage));
            }
        }

    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
        // clients.delete(internalClientMap.get(ws));
        // internalClientMap.delete(ws);
        const clientId = clientsReverseMap.get(ws);
        clients.delete(clientId);
        clientsReverseMap.delete(ws);
        console.log(`Client ${clientId} disconnected from ${request.socket.remoteAddress}`);
    });
});

