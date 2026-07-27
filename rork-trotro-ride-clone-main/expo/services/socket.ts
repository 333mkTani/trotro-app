import { io, Socket } from "socket.io-client";
import { API_BASE_URL, getAuthToken } from "@/services/api";

let socket: Socket | null = null;
let connecting: Promise<Socket> | null = null;

/**
 * Lazily creates (or reuses) a single authenticated socket connection.
 * Room conventions mirror the backend (see backend/src/realtime/io.js):
 *   bus:<busId>, route:<routeId>, user:<userId>
 */
export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  if (connecting) return connecting;

  connecting = (async () => {
    const token = await getAuthToken();
    if (!token) throw new Error("Not authenticated");

    if (socket) socket.disconnect();

    socket = io(API_BASE_URL, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
      autoConnect: true,
    });

    await new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        socket?.off("connect_error", onError);
        resolve();
      };
      const onError = (err: Error) => {
        socket?.off("connect", onConnect);
        reject(err);
      };
      socket?.once("connect", onConnect);
      socket?.once("connect_error", onError);
    });

    return socket;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function subscribeToBus(busId: string): void {
  socket?.emit("subscribe:bus", busId);
}

export function unsubscribeFromBus(busId: string): void {
  socket?.emit("unsubscribe:bus", busId);
}

export type BusLocationEvent = {
  busId: string;
  routeId: string | null;
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  driverId?: string;
  ts: number;
};
