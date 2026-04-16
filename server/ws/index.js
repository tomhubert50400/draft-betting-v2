const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

let wss;
const clients = new Set();

function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        ws.userId = payload.userId;
        ws.authenticated = true;
      } catch (err) {
        ws.authenticated = false;
      }
    }

    clients.add(ws);

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  console.log('WebSocket server initialized');
}

function broadcast(data) {
  const message = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

function getClientCount() {
  return clients.size;
}

module.exports = { initWebSocket, broadcast, getClientCount };
