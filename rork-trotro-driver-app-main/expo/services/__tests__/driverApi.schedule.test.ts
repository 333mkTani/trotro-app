jest.mock('@/services/api', () => ({ __esModule: true, default: {} }));
jest.mock('@/store/driverStore', () => ({ useDriverStore: { getState: jest.fn() } }));

import { mapFutureRequest } from '../driverApi';

describe('driver scheduled API mapping', () => {
  it('maps backend snake_case fields and preserves lifecycle status', () => {
    expect(mapFutureRequest({
      id: 'occ-1', service_date: '2026-08-10', boarding_start_at: '2026-08-10T08:00:00Z',
      boarding_end_at: '2026-08-10T09:00:00Z', departure_stop_id: 'stop-1',
      passenger_name: 'Ama Mensah', route_name: 'Kejetia - Adum', departure_stop_name: 'Kejetia',
      destination_stop_name: 'Adum', future_seats_remaining: 4,
      primary_acceptance_deadline: '2026-08-09T17:00:00Z',
      final_acceptance_deadline: '2026-08-09T20:00:00Z', backup_matching_enabled: true,
      status: 'boarding_open', driver_response: 'accepted', bus_registration: 'AS-1234-26',
    })).toMatchObject({
      id: 'occ-1', passengerName: 'Ama Mensah', routeName: 'Kejetia - Adum', availableSeats: 4,
      backupMatchingEnabled: true, status: 'boarding_open', driverResponse: 'accepted',
      busRegistration: 'AS-1234-26',
    });
  });
});
