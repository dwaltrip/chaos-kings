import { WebSocketServer, WebSocket } from 'ws';

interface ChatMessage {
  user: string;
  message: string;
  timestamp: number;
}

interface RoomMessage extends ChatMessage {
  room: string;
  type: 'chat' | 'join' | 'leave';
}

interface ClientData {
  ws: WebSocket;
  room?: string;
}

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

const rooms = new Map<string, Set<WebSocket>>();
const clients = new Map<WebSocket, ClientData>();

console.log(`WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', (ws: WebSocket) => {
  console.log('New client connected');
  
  clients.set(ws, { ws });

  ws.on('message', (data: Buffer) => {
    try {
      const message: RoomMessage = JSON.parse(data.toString());
      console.log('Received:', message);

      if (message.type === 'join') {
        joinRoom(ws, message.room);
      } else if (message.type === 'leave') {
        leaveRoom(ws, message.room);
      } else if (message.type === 'chat') {
        broadcastToRoom(message.room, message);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    const clientData = clients.get(ws);
    if (clientData?.room) {
      leaveRoom(ws, clientData.room);
    }
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function joinRoom(ws: WebSocket, roomId: string) {
  const clientData = clients.get(ws);
  if (!clientData) return;

  // Leave current room if in one
  if (clientData.room) {
    leaveRoom(ws, clientData.room);
  }

  // Join new room
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId)!.add(ws);
  clientData.room = roomId;
  
  console.log(`Client joined room: ${roomId}`);
}

function leaveRoom(ws: WebSocket, roomId: string) {
  const room = rooms.get(roomId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) {
      rooms.delete(roomId);
    }
  }
  
  const clientData = clients.get(ws);
  if (clientData) {
    clientData.room = undefined;
  }
  
  console.log(`Client left room: ${roomId}`);
}

function broadcastToRoom(roomId: string, message: RoomMessage) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  room.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}
