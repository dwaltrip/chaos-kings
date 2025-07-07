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

export class WebSocketManager {
  private wss: WebSocketServer;
  private rooms = new Map<string, Set<WebSocket>>();
  private clients = new Map<WebSocket, ClientData>();

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.setupEventHandlers();
    console.log(`WebSocket server running on ws://localhost:${port}`);
  }

  private setupEventHandlers() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New client connected');
      
      this.clients.set(ws, { ws });

      ws.on('message', (data: Buffer) => {
        try {
          const message: RoomMessage = JSON.parse(data.toString());
          console.log('Received:', message);

          if (message.type === 'join') {
            this.joinRoom(ws, message.room);
          } else if (message.type === 'leave') {
            this.leaveRoom(ws, message.room);
          } else if (message.type === 'chat') {
            this.broadcastToRoom(message.room, message);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected');
        const clientData = this.clients.get(ws);
        if (clientData?.room) {
          this.leaveRoom(ws, clientData.room);
        }
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  private joinRoom(ws: WebSocket, roomId: string) {
    const clientData = this.clients.get(ws);
    if (!clientData) return;

    // Leave current room if in one
    if (clientData.room) {
      this.leaveRoom(ws, clientData.room);
    }

    // Join new room
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(ws);
    clientData.room = roomId;
    
    console.log(`Client joined room: ${roomId}`);
  }

  private leaveRoom(ws: WebSocket, roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }
    
    const clientData = this.clients.get(ws);
    if (clientData) {
      clientData.room = undefined;
    }
    
    console.log(`Client left room: ${roomId}`);
  }

  private broadcastToRoom(roomId: string, message: RoomMessage) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    room.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}