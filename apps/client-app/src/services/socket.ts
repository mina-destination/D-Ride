import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace('/api', '') 
  : 'http://localhost:3000';

class SocketService {
  public socket: Socket | null = null;

  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
      });

      this.socket.on('connect', () => {
        console.log('Connected to WebSocket server');
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribeToVehicle(vehicleId: string) {
    if (this.socket) {
      this.socket.emit('subscribeToVehicle', vehicleId);
    }
  }

  unsubscribeFromVehicle(vehicleId: string) {
    if (this.socket) {
      this.socket.emit('unsubscribeFromVehicle', vehicleId);
    }
  }

  onVehicleLocationUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('vehicleLocationUpdate', callback);
    }
  }

  offVehicleLocationUpdate(callback?: (data: any) => void) {
    if (this.socket) {
      if (callback) {
        this.socket.off('vehicleLocationUpdate', callback);
      } else {
        this.socket.off('vehicleLocationUpdate');
      }
    }
  }
}

export const socketService = new SocketService();
