import { io, Socket } from 'socket.io-client';
import { logger } from '@transport/shared-api';

const SOCKET_URL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') 
  : 'http://localhost:3000';

class SocketService {
  public socket: Socket | null = null;

  connect() {
    if (!this.socket) {
      const token = localStorage.getItem('dride_token');
      this.socket = io(SOCKET_URL, {
        path: '/api/socket.io',
        transports: ['websocket'],
        auth: { token },
      });

      this.socket.on('connect', () => {
        logger.info('Connected to WebSocket server');
      });

      this.socket.on('disconnect', () => {
        logger.info('Disconnected from WebSocket server');
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  forceDisconnect() {
    if (this.socket) {
      this.socket.off('connect');
      this.socket.off('disconnect');
      this.socket.off('vehicleLocationUpdate');
      this.socket.off('checkpointUpdate');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribeToVehicle(vehicleId: string, ticketCode?: string) {
    if (this.socket) {
      if (ticketCode) {
        this.socket.emit('subscribeToVehicle', { vehicleId, ticketCode });
      } else {
        this.socket.emit('subscribeToVehicle', vehicleId);
      }
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

  onCheckpointUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('checkpointUpdate', callback);
    }
  }

  offCheckpointUpdate(callback?: (data: any) => void) {
    if (this.socket) {
      if (callback) {
        this.socket.off('checkpointUpdate', callback);
      } else {
        this.socket.off('checkpointUpdate');
      }
    }
  }

  onEtaUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('etaUpdate', callback);
    }
  }

  offEtaUpdate(callback?: (data: any) => void) {
    if (this.socket) {
      if (callback) {
        this.socket.off('etaUpdate', callback);
      } else {
        this.socket.off('etaUpdate');
      }
    }
  }
}

export const socketService = new SocketService();
