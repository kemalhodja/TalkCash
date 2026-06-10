import { auth } from "./auth";

const WS_BASE = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace("http", "ws");

export class SharedWalletWS {
  private ws: WebSocket | null = null;
  private walletId: string;
  private onMessage: (data: any) => void;

  constructor(walletId: string, onMessage: (data: any) => void) {
    this.walletId = walletId;
    this.onMessage = onMessage;
  }

  async connect() {
    const token = await auth.getToken();
    if (!token) return;
    this.ws = new WebSocket(`${WS_BASE}/ws/shared-wallet/${this.walletId}?token=${token}`);
    this.ws.onmessage = (event) => this.onMessage(JSON.parse(event.data));
    this.ws.onclose = () => setTimeout(() => this.connect(), 3000);
  }

  sendExpense(amount: number, description: string, userName: string) {
    this.ws?.send(JSON.stringify({ action: "expense", amount, description, user_name: userName }));
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
