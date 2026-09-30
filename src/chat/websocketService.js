import { WS_BASE } from './api';

export class WebSocketService {
  constructor(appointmentId, token, onConnect, onDisconnect, getToken) {
    this.appointmentId = appointmentId;
    this.token = String(token || '').replace(/^Bearer\s+/i, '');
    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;
    this.getToken = getToken;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 12;
    this.reconnectDelay = 1500;
    this.maxReconnectDelay = 30000;
    this.handlers = new Map();
    this.isConnecting = false;
    this.pingInterval = null;
    this.reconnectTimer = null;
    this.isIntentionalClose = false;
  }

  updateToken(token) {
    this.token = String(token || '').replace(/^Bearer\s+/i, '');
  }

  async connect() {
    if (this.isConnecting) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.ws?.readyState === WebSocket.CONNECTING) return;

    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    this.isConnecting = true;
    this.isIntentionalClose = false;

    if (this.getToken) {
      try {
        const fresh = await this.getToken();
        if (fresh) this.updateToken(fresh);
      } catch {
        // keep existing token
      }
    }

    if (!this.token) {
      this.isConnecting = false;
      this.reconnect();
      return;
    }

    const url = `${WS_BASE}/ws/communication/appointments/${this.appointmentId}/?token=${encodeURIComponent(this.token)}`;

    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => this.handleOpen();
      this.ws.onmessage = (event) => this.handleMessage(event);
      this.ws.onclose = (event) => this.handleClose(event);
      this.ws.onerror = () => {
        this.isConnecting = false;
      };
    } catch {
      this.isConnecting = false;
      this.reconnect();
    }
  }

  handleOpen() {
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    this.startPing();
    this.onConnect?.();
  }

  handleMessage(event) {
    try {
      if (!event.data) return;
      const data = JSON.parse(event.data);
      if (data.type === 'chat.connected') this.emit('connected', data);
      else if (data.type === 'chat.receive') this.emit('message', data);
      else if (data.type === 'chat.error') this.emit('error', data);
      else if (data.type === 'chat.read') this.emit('read', data);
      else if (data.type === 'ping') this.sendPong();
      else if (data.message) this.emit('message', data);
    } catch {
      // ignore parse errors
    }
  }

  handleClose() {
    this.isConnecting = false;
    this.stopPing();
    this.ws = null;
    this.onDisconnect?.();
    if (this.isIntentionalClose) return;
    this.reconnect();
  }

  reconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', {
        type: 'chat.error',
        error: 'Realtime unavailable. Messages still send over network.',
      });
      return;
    }
    this.reconnectAttempts += 1;
    const delay = Math.min(
      this.reconnectDelay * 2 ** (this.reconnectAttempts - 1),
      this.maxReconnectDelay,
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isIntentionalClose) void this.connect();
    }, delay);
  }

  sendMessage() {
    return false;
  }

  sendRead(messageIds) {
    if (!this.isConnected()) return false;
    try {
      this.ws?.send(JSON.stringify({ type: 'chat.read', message_ids: messageIds }));
      return true;
    } catch {
      return false;
    }
  }

  sendPong() {
    if (!this.isConnected()) return;
    try {
      this.ws?.send(JSON.stringify({ type: 'pong' }));
    } catch {
      // ignore
    }
  }

  startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (!this.isConnected()) return;
      try {
        this.ws?.send(JSON.stringify({ type: 'ping' }));
      } catch {
        // ignore
      }
    }, 30000);
  }

  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event).push(handler);
  }

  off(event, handler) {
    const handlers = this.handlers.get(event);
    if (!handlers) return;
    this.handlers.set(
      event,
      handlers.filter((item) => item !== handler),
    );
  }

  emit(event, data) {
    const handlers = this.handlers.get(event);
    if (!handlers) return;
    handlers.forEach((handler) => handler(data));
  }

  disconnect() {
    this.isIntentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPing();
    if (this.ws) {
      try {
        this.ws.close(1000, 'Normal closure');
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.isConnecting = false;
  }
}
