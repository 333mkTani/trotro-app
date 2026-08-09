import type { FutureRideRequest, FutureRideRequestStatus } from '@/types';

export const FUTURE_REQUEST_LABELS: Record<FutureRideRequestStatus, string> = {
  pending: 'Awaiting drivers',
  offered: 'Response needed',
  accepted: 'Accepted — future seat reserved',
  boarding_open: 'Boarding open',
  boarded: 'Passenger boarded',
  departed: 'Departed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired / no-show',
  unmatched: 'No driver matched',
};

export const OPEN_FUTURE_STATUSES: FutureRideRequestStatus[] = ['pending', 'offered'];
export const UPCOMING_FUTURE_STATUSES: FutureRideRequestStatus[] = ['accepted', 'boarding_open', 'boarded'];

export const groupFutureRequests = (requests: FutureRideRequest[]) => ({
  awaiting: requests.filter((request) => OPEN_FUTURE_STATUSES.includes(request.status)),
  upcoming: requests.filter((request) => UPCOMING_FUTURE_STATUSES.includes(request.status)),
  history: requests.filter((request) =>
    !OPEN_FUTURE_STATUSES.includes(request.status) && !UPCOMING_FUTURE_STATUSES.includes(request.status)),
});

export const isBackupMatchingActive = (request: FutureRideRequest, nowMs = Date.now()) =>
  request.backupMatchingEnabled &&
  OPEN_FUTURE_STATUSES.includes(request.status) &&
  nowMs >= new Date(request.primaryDeadline).getTime() &&
  nowMs < new Date(request.finalDeadline).getTime();

export const isNotificationSelected = (requestId: string, occurrenceId?: string) =>
  Boolean(occurrenceId && requestId === occurrenceId);

type QueryInvalidator = {
  invalidateQueries: (options: { queryKey: readonly unknown[] }) => Promise<unknown>;
};

export const invalidateScheduledRideQueries = async (
  qc: QueryInvalidator,
  occurrenceId?: string,
) => {
  const keys: (readonly unknown[])[] = [
    ['future-requests'],
    ['future-request-history'],
    ['bookings'],
    ['confirmed-bookings'],
    ['dashboard'],
    ['seat-sync'],
  ];
  if (occurrenceId) keys.push(['future-request-detail', occurrenceId]);
  await Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
};
