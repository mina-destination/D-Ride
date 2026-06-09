import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') 
  : 'http://localhost:3000';

class SocketService {
  public socket: Socket | null = null;
  private disconnectTimeout: any = null;

  connect() {
    if (this.disconnectTimeout) {
      clearTimeout(this.disconnectTimeout);
      this.disconnectTimeout = null;
    }

    if (!this.socket) {
      const token = localStorage.getItem('dride_driver_token');
      this.socket = io(SOCKET_URL, {
        path: '/api/socket.io',
        transports: ['websocket'],
        auth: { token },
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
    if (this.disconnectTimeout) return;

    this.disconnectTimeout = setTimeout(() => {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      this.disconnectTimeout = null;
    }, 1000);
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
