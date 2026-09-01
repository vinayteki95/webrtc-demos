import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });
const clients = new Map();
const socketToId = new Map();

wss.on("connection", (ws, request) => {
    console.log("client connected", request.socket.remoteAddress);

    ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "register") {
            clients.set(msg.id, ws);
            socketToId.set(ws, msg.id);
            console.log("registered", msg.id);
            return;
        }

        const dest = clients.get(msg.to);
        if (!dest) {
            const from = clients.get(msg.from);
            from?.send(JSON.stringify({
                type: "wsserror",
                message: "recipient not connected/registered",
            }));
            return;
        }

        dest.send(JSON.stringify(msg));
    });

    ws.on("close", () => {
        const id = socketToId.get(ws);
        if (id) clients.delete(id);
        socketToId.delete(ws);
        console.log("disconnected", id);
    });
});

console.log("signaling relay on ws://localhost:8080");
