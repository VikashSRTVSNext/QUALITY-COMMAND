type MessageCallback = (data: any) => void;

// Shape of a valid inbound socket frame. Anything that does not match is dropped
// rather than forwarded to subscribers, so untrusted/malformed data never reaches
// downstream consumers (React state, chart options, etc.).
interface SocketFrame {
  type?: string;
  channel?: string;
  payload?: unknown;
}

function isValidFrame(value: unknown): value is SocketFrame {
  if (typeof value !== 'object' || value === null) return false;
  const frame = value as Record<string, unknown>;
  if (frame.type !== undefined && typeof frame.type !== 'string') return false;
  if (frame.channel !== undefined && typeof frame.channel !== 'string') return false;
  return true;
}

export class SocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private heartbeatInterval = 30000;
  private pingTimeout: number | null = null;
  private subscriptionRegistry = new Map<string, Set<MessageCallback>>();
  
  constructor(url: string) {
    this.url = url;
  }

  private closedByUser = false;

  public connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.closedByUser = false;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = this.handleOpen.bind(this);
    this.ws.onmessage = this.handleMessage.bind(this);
    this.ws.onerror = this.handleError.bind(this);
    this.ws.onclose = this.handleClose.bind(this);
  }

  // Intentional teardown: stops heartbeat + reconnection and closes the socket.
  public disconnect(): void {
    this.closedByUser = true;
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
  }

  private handleOpen(): void {
    this.reconnectAttempts = 0;
    this.startHeartbeat();
    this.resubscribeAll();
  }

  private handleMessage(event: MessageEvent): void {
    // Only string frames are expected; ignore binary/blob data.
    if (typeof event.data !== 'string') {
      console.warn('Ignoring non-string socket frame');
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data);
    } catch (e) {
      console.error('Failed to parse socket payload', e);
      return;
    }

    if (!isValidFrame(parsed)) {
      console.warn('Dropping malformed socket frame');
      return;
    }

    if (parsed.type === 'PONG') {
      this.resetHeartbeat();
      return;
    }

    // Dispatch only to channels we actually subscribed to. Consumers must still
    // treat payload as untrusted and avoid rendering it as HTML.
    if (typeof parsed.channel !== 'string') return;
    const callbacks = this.subscriptionRegistry.get(parsed.channel);
    if (callbacks) {
      callbacks.forEach((callback) => callback(parsed.payload));
    }
  }

  private handleClose(): void {
    this.stopHeartbeat();
    if (!this.closedByUser) this.attemptReconnect();
  }

  private handleError(error: Event): void {
    console.error('Socket error occurred', error);
  }

  private attemptReconnect(): void {
    const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, this.maxReconnectDelay);
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }

  public subscribe(channel: string, callback: MessageCallback): () => void {
    if (!this.subscriptionRegistry.has(channel)) {
      this.subscriptionRegistry.set(channel, new Set());
    }
    
    this.subscriptionRegistry.get(channel)!.add(callback);
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'SUBSCRIBE', channel }));
    }
    
    return () => {
      const callbacks = this.subscriptionRegistry.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptionRegistry.delete(channel);
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ action: 'UNSUBSCRIBE', channel }));
          }
        }
      }
    };
  }

  private resubscribeAll(): void {
    this.subscriptionRegistry.forEach((_, channel) => {
      this.ws?.send(JSON.stringify({ action: 'SUBSCRIBE', channel }));
    });
  }

  private startHeartbeat(): void {
    this.pingTimeout = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, this.heartbeatInterval);
  }

  private resetHeartbeat(): void {
    // Optional connection health reporting logic
  }

  private stopHeartbeat(): void {
    if (this.pingTimeout) {
      clearInterval(this.pingTimeout);
      this.pingTimeout = null;
    }
  }
}
