import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

let socket: Socket | null = null;
let connecting: Promise<Socket> | null = null;

/**
 * Lazily creates (or reuses) a single authenticated socket connection.
 * The driver is always in the `driver:<driverId>` room server-side
 * (see backend/src/realtime/io.js), so bookings already assigned to this
 * driver arrive automatically. Unclaimed same-route requests only arrive
 * if this client also calls subscribeToRoute() for its current route.
 */
export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  if (connecting) return connecting;

  connecting = (async () => {
    const token = useAuthStore.getState().accessToken;
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

export function subscribeToRoute(routeId: string): void {
  socket?.emit("subscribe:route", routeId);
}

export function unsubscribeFromRoute(routeId: string): void {
  socket?.emit("unsubscribe:route", routeId);
}

export type BookingSocketEvent = {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  bus_id: string | null;
  route_id: string | null;
  status: string;
  pickup_stop_name?: string;
  destination_stop_name?: string;
  [key: string]: unknown;
};
