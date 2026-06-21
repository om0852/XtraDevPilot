import { WebSocketServer } from 'ws';

const WSS_PORT = 8080;
const wss = new WebSocketServer({ port: WSS_PORT });

console.log("Listening on port 8080 for extension...");

wss.on('connection', (ws) => {
  console.log("Extension connected. Sending GET_DOM request...");
  
  ws.send(JSON.stringify({ id: 1, action: "GET_DOM" }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.id === 1) {
        if (data.error) {
          console.error("Error from extension:", data.error);
        } else {
          console.log("--- DOM SNAPSHOT ---");
          console.log(typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2));
          console.log("--------------------");
        }
        process.exit(0);
      }
    } catch (e) {
      console.error("Failed to parse message:", e);
    }
  });
});

setTimeout(() => {
  console.error("Timeout waiting for connection or response.");
  process.exit(1);
}, 45000); // Wait 45 seconds
