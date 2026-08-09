import type { FutureRideRequest, FutureRideRequestStatus } from '@/types';
import {
  groupFutureRequests,
  invalidateScheduledRideQueries,
  isBackupMatchingActive,
  isNotificationSelected,
  mergeFutureRequestSources,
} from '../futureRequestState';

const request = (status: FutureRideRequestStatus, id: string = status): FutureRideRequest => ({
  id, status, serviceDate: '2026-08-10', boardingStart: '2026-08-10T08:00:00Z',
  boardingEnd: '2026-08-10T09:00:00Z', departureStopId: 'stop-1', passengerName: 'Ama',
  routeName: 'Adum route', departureStation: 'Kejetia', destinationStation: 'Adum',
  availableSeats: 3, primaryDeadline: '2026-08-09T17:00:00Z',
  finalDeadline: '2026-08-09T20:00:00Z', backupMatchingEnabled: true,
});

describe('future request state', () => {
  it('groups awaiting, accepted upcoming, and history without collapsing lifecycle states', () => {
    const grouped = groupFutureRequests([
      request('pending'), request('offered'), request('accepted'), request('boarding_open'),
      request('boarded'), request('completed'), request('cancelled'), request('expired'), request('unmatched'),
    ]);
    expect(grouped.awaiting.map((item) => item.status)).toEqual(['pending', 'offered']);
    expect(grouped.upcoming.map((item) => item.status)).toEqual(['accepted', 'boarding_open', 'boarded']);
    expect(grouped.history.map((item) => item.status)).toEqual(['completed', 'cancelled', 'expired', 'unmatched']);
  });

  it('recognizes backup matching only inside its actionable window', () => {
    expect(isBackupMatchingActive(request('offered'), Date.parse('2026-08-09T18:00:00Z'))).toBe(true);
    expect(isBackupMatchingActive(request('offered'), Date.parse('2026-08-09T21:00:00Z'))).toBe(false);
    expect(isBackupMatchingActive(request('accepted'), Date.parse('2026-08-09T18:00:00Z'))).toBe(false);
  });

  it('highlights only the notification-selected occurrence', () => {
    expect(isNotificationSelected('occ-1', 'occ-1')).toBe(true);
    expect(isNotificationSelected('occ-2', 'occ-1')).toBe(false);
  });

  it('lets refreshed cancellation history replace a stale accepted detail', () => {
    const merged = mergeFutureRequestSources(
      request('accepted', 'occ-1'),
      [],
      [request('cancelled', 'occ-1')],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('cancelled');
  });

  it.each(['acceptance', 'scheduled boarding'])('invalidates schedule consumers after %s', async () => {
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);
    await invalidateScheduledRideQueries({ invalidateQueries }, 'occ-1');
    const keys = invalidateQueries.mock.calls.map(([value]) => value.queryKey);
    expect(keys).toEqual(expect.arrayContaining([
      ['future-requests'], ['future-request-history'], ['future-request-detail', 'occ-1'],
      ['bookings'], ['confirmed-bookings'], ['dashboard'], ['seat-sync'],
    ]));
  });
});
