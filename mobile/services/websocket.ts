import { auth } from "./auth";

function wsBase(): string {
  const api = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  if (api.startsWith("https://")) return api.replace("https://", "wss://");
  return api.replace("http://", "ws://");
}

export class SharedWalletWS {
  private ws: WebSocket | null = null;
  private walletId: string;
  private onMessage: (data: any) => void;
  private reconnectAttempt = 0;
  private maxReconnectAttempts = 8;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(walletId: string, onMessage: (data: any) => void) {
    this.walletId = walletId;
    this.onMessage = onMessage;
  }

  async connect() {
    if (this.closed) return;
    const token = await auth.getToken();
    if (!token) return;

    this.ws = new WebSocket(`${wsBase()}/ws/shared-wallet/${this.walletId}?token=${token}`);
    this.ws.onopen = () => { this.reconnectAttempt = 0; };
    this.ws.onmessage = (event) => {
      try {
        this.onMessage(JSON.parse(event.data));
      } catch {
        /* ignore malformed payloads */
      }
    };
    this.ws.onclose = () => {
      this.ws = null;
      if (this.closed || this.reconnectAttempt >= this.maxReconnectAttempts) return;
      const delay = Math.min(30000, 1000 * 2 ** this.reconnectAttempt);
      this.reconnectAttempt += 1;
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
  }

  sendExpense(amount: number, description: string, userName: string) {
    this.ws?.send(JSON.stringify({ action: "expense", amount, description, user_name: userName }));
  }

  disconnect() {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
