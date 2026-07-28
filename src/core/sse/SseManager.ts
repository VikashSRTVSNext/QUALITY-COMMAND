type MessageCallback = (data: any) => void;

interface SseFrame {
  type?: string;
  channel?: string;
  payload?: unknown;
}

function isValidFrame(value: unknown): value is SseFrame {
  if (typeof value !== 'object' || value === null) return false;
  const frame = value as Record<string, unknown>;
  if (frame.type !== undefined && typeof frame.type !== 'string') return false;
  if (frame.channel !== undefined && typeof frame.channel !== 'string') return false;
  return true;
}

export class SseManager {
  private es: EventSource | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private subscriptionRegistry = new Map<string, Set<MessageCallback>>();
  private eventListeners = new Map<string, (event: MessageEvent) => void>();
  private closedByUser = false;

  constructor(url: string) {
    this.url = url;
  }

  public connect(): void {
    if (this.es && this.es.readyState !== EventSource.CLOSED) return;
    this.closedByUser = false;

    this.es = new EventSource(this.url);

    this.es.onopen = this.handleOpen.bind(this);
    this.es.onerror = this.handleError.bind(this);
    
    // Register the default "message" event listener
    this.es.onmessage = this.handleMessage.bind(this);

    // Register active listeners for all subscribed channels (if any are already subscribed)
    this.subscriptionRegistry.forEach((_, channel) => {
      this.registerChannelListener(channel);
    });
  }

  public disconnect(): void {
    this.closedByUser = true;
    if (this.es) {
      // Remove all event listeners before closing
      this.subscriptionRegistry.forEach((_, channel) => {
        const listener = this.eventListeners.get(channel);
        if (listener && this.es) {
          this.es.removeEventListener(channel, listener);
        }
      });
      this.es.close();
      this.es = null;
    }
    this.eventListeners.clear();
  }

  private handleOpen(): void {
    this.reconnectAttempts = 0;
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== 'string') {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data);
    } catch (e) {
      console.error('Failed to parse SSE payload', e);
      return;
    }

    if (!isValidFrame(parsed)) {
      return;
    }

    if (typeof parsed.channel !== 'string') return;
    const callbacks = this.subscriptionRegistry.get(parsed.channel);
    if (callbacks) {
      callbacks.forEach((callback) => callback(parsed.payload));
    }
  }

  private handleError(error: Event): void {
    console.error('SSE error occurred', error);
    
    // EventSource automatically reconnects, but if it remains closed, we can force-connect with backoff
    if (this.es?.readyState === EventSource.CLOSED && !this.closedByUser) {
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, this.maxReconnectDelay);
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }

  private registerChannelListener(channel: string): void {
    if (!this.es || this.eventListeners.has(channel)) return;

    const listener = (event: MessageEvent) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch (e) {
        console.error(`Failed to parse SSE data for channel ${channel}`, e);
        return;
      }

      const callbacks = this.subscriptionRegistry.get(channel);
      if (callbacks) {
        callbacks.forEach((callback) => callback(parsed));
      }
    };

    this.eventListeners.set(channel, listener);
    this.es.addEventListener(channel, listener);
  }

  public subscribe(channel: string, callback: MessageCallback): () => void {
    if (!this.subscriptionRegistry.has(channel)) {
      this.subscriptionRegistry.set(channel, new Set());
    }

    this.subscriptionRegistry.get(channel)!.add(callback);

    // Register active listener if connected
    if (this.es && (this.es.readyState === EventSource.OPEN || this.es.readyState === EventSource.CONNECTING)) {
      this.registerChannelListener(channel);
    }

    return () => {
      const callbacks = this.subscriptionRegistry.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptionRegistry.delete(channel);
          
          const listener = this.eventListeners.get(channel);
          if (listener && this.es) {
            this.es.removeEventListener(channel, listener);
          }
          this.eventListeners.delete(channel);
        }
      }
    };
  }
}
