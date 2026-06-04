import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace('/api', '') 
  : 'http://localhost:3000';

class SocketService {
  public socket: Socket | null = null;

  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        path: '/api/socket.io',
        transports: ['websocket'],
      });

      this.socket.on('connect', () => {
        console.log('Driver connected to WebSocket server');
      });

      this.socket.on('disconnect', () => {
        console.log('Driver disconnected from WebSocket server');
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  sendLocation(payload: {
    vehicleId: string;
    driverId: string;
    longitude: number;
    latitude: number;
  }) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('driverLocationPush', payload);
    }
  }
}

export const socketService = new SocketService();
