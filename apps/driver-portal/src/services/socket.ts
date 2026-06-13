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
        transports: ['polling', 'websocket'],
        auth: { token },
      });

      this.socket.on('connect', () => {
        console.log('Driver connected to WebSocket server');
        // Synchronize offline logs and checkpoint statuses upon reconnecting
        this.flushOfflineLocations();
        this.flushOfflineCheckpointUpdates();
      });

      this.socket.on('sessionExpired', (data: any) => {
        alert(data.message || 'Session expired. You logged in on another device.');
        localStorage.removeItem('dride_driver_token');
        window.location.reload();
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

  forceDisconnect() {
    if (this.disconnectTimeout) {
      clearTimeout(this.disconnectTimeout);
      this.disconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.off('connect');
      this.socket.off('disconnect');
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
    } else {
      this.cacheOfflineLocation(payload);
    }
  }

  sendCheckpointUpdate(payload: {
    vehicleId: string;
    arrivedCheckpoints: string[];
  }) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('driverCheckpointUpdate', payload);
    } else {
      this.cacheOfflineCheckpointUpdate(payload);
    }
  }

  private cacheOfflineLocation(point: any) {
    try {
      const stored = localStorage.getItem('dride_offline_coords');
      const queue = stored ? JSON.parse(stored) : [];
      // Restrict log length to avoid excessive LocalStorage utilization
      if (queue.length < 1000) {
        queue.push(point);
        localStorage.setItem('dride_offline_coords', JSON.stringify(queue));
      }
    } catch (err) {
      console.error('Failed to cache offline location:', err);
    }
  }

  private flushOfflineLocations() {
    try {
      const stored = localStorage.getItem('dride_offline_coords');
      if (!stored) return;
      const queue = JSON.parse(stored);
      if (queue.length === 0) return;

      console.log(`Flushing ${queue.length} offline cached locations...`);
      const remaining: any[] = [];

      queue.forEach((point: any) => {
        if (this.socket && this.socket.connected) {
          this.socket.emit('driverLocationPush', point);
        } else {
          remaining.push(point);
        }
      });

      if (remaining.length > 0) {
        localStorage.setItem('dride_offline_coords', JSON.stringify(remaining));
      } else {
        localStorage.removeItem('dride_offline_coords');
      }
    } catch (err) {
      console.error('Failed to flush offline locations:', err);
    }
  }

  private cacheOfflineCheckpointUpdate(payload: any) {
    try {
      localStorage.setItem(`dride_offline_checkpoint_${payload.vehicleId}`, JSON.stringify(payload));
    } catch (err) {
      console.error('Failed to cache offline checkpoint update:', err);
    }
  }

  private flushOfflineCheckpointUpdates() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('dride_offline_checkpoint_')) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const payload = JSON.parse(stored);
            if (this.socket && this.socket.connected) {
              this.socket.emit('driverCheckpointUpdate', payload);
              localStorage.removeItem(key);
              // Decrement search pointer to align with mutation
              i--;
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to flush offline checkpoints:', err);
    }
  }
}

export const socketService = new SocketService();
