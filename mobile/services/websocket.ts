import { auth } from "./auth";
import { getApiBaseUrl } from "./config";

function wsBase(): string {
  const api = getApiBaseUrl();
  if (api.startsWith("https://")) return api.replace("https://", "wss://");
  return api.replace("http://", "ws://");
}

type PendingExpense = { amount: number; description: string; userName: string };

export class SharedWalletWS {
  private ws: WebSocket | null = null;
  private walletId: string;
  private onMessage: (data: any) => void;
  private onError?: (message: string) => void;
  private reconnectAttempt = 0;
  private maxReconnectAttempts = 8;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private authenticated = false;
  private pendingExpenses: PendingExpense[] = [];

  constructor(walletId: string, onMessage: (data: any) => void, onError?: (message: string) => void) {
    this.walletId = walletId;
    this.onMessage = onMessage;
    this.onError = onError;
  }

  private flushPending() {
    if (!this.authenticated || !this.ws) return;
    for (const expense of this.pendingExpenses) {
      this.ws.send(JSON.stringify({
        action: "expense",
        amount: expense.amount,
        description: expense.description,
        user_name: expense.userName,
      }));
    }
    this.pendingExpenses = [];
  }

  async connect() {
    if (this.closed) return;
    const token = await auth.getToken();
    if (!token) return;

    this.authenticated = false;
    this.ws = new WebSocket(`${wsBase()}/ws/shared-wallet/${this.walletId}`);
    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.ws?.send(JSON.stringify({ action: "auth", token }));
    };
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "auth_ok") {
          this.authenticated = true;
          this.flushPending();
          return;
        }
        if (data.type === "error") {
          this.onError?.(data.message || "websocket_error");
          return;
        }
        this.onMessage(data);
      } catch {
        /* ignore malformed payloads */
      }
    };
    this.ws.onerror = () => {
      this.onError?.("websocket_error");
    };
    this.ws.onclose = () => {
      this.ws = null;
      this.authenticated = false;
      if (this.closed || this.reconnectAttempt >= this.maxReconnectAttempts) return;
      const delay = Math.min(30000, 1000 * 2 ** this.reconnectAttempt);
      this.reconnectAttempt += 1;
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
  }

  sendExpense(amount: number, description: string, userName: string) {
    if (!this.authenticated || !this.ws) {
      this.pendingExpenses.push({ amount, description, userName });
      return;
    }
    this.ws.send(JSON.stringify({ action: "expense", amount, description, user_name: userName }));
  }

  disconnect() {
    this.closed = true;
    this.authenticated = false;
    this.pendingExpenses = [];
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
