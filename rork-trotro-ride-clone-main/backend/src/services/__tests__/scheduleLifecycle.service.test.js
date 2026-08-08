jest.mock('../../config/db', () => ({
  withTransaction: jest.fn((fn) => fn({ query: jest.fn() })),
}));
jest.mock('../../models/scheduleLifecycle.model');
jest.mock('../../models/scheduleNotification.model');
jest.mock('../../models/booking.model');
jest.mock('../../models/bus.model');
jest.mock('../../models/code.model');
jest.mock('../../utils/codes', () => ({
  generateBoardingCode: jest.fn(() => 'ABC234'),
  buildQrPayload: jest.fn(() => '{"v":2}'),
}));

const lifecycleModel = require('../../models/scheduleLifecycle.model');
const notificationModel = require('../../models/scheduleNotification.model');
const bookingModel = require('../../models/booking.model');
const busModel = require('../../models/bus.model');
const codeModel = require('../../models/code.model');
const service = require('../scheduleLifecycle.service');

const now = new Date('2026-08-10T05:45:00.000Z');
const openCode = {
  id: 'code-1', occurrence_id: 'occ-1', code: 'ABC234', status: 'active',
  occurrence_status: 'boarding_open', passenger_id: 'pass-1', assigned_driver_id: 'driver-1',
  assigned_bus_id: 'bus-1', route_id: 'route-1', departure_stop_id: 'stop-1',
  departure_stop_name: 'Kejetia', destination_stop_id: 'stop-2', destination_stop_name: 'Adum',
  route_name: 'Kejetia - Adum', route_fare: 5, boarding_end_at: '2026-08-10T06:30:00.000Z',
  valid_from: '2026-08-10T05:30:00.000Z', valid_until: '2026-08-10T06:30:00.000Z', qr_payload: '{}',
};

describe('scheduled boarding lifecycle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('activates codes only for occurrences returned by the due transition', async () => {
    lifecycleModel.openDue.mockResolvedValue([{ id: 'occ-1', passenger_id: 'pass-1', service_date: '2026-08-10', boarding_start_at: '2026-08-10T06:00:00.000Z', boarding_opens_at: now, boarding_end_at: openCode.valid_until }]);
    lifecycleModel.insertCode.mockResolvedValue({ id: 'code-1' });
    await expect(service.activateDue(now)).resolves.toHaveLength(1);
    expect(lifecycleModel.insertCode).toHaveBeenCalledTimes(1);
    expect(notificationModel.queue).toHaveBeenCalledWith('occ-1', 'pass-1', 'schedule_boarding_open', expect.any(Object), expect.anything());
    expect(notificationModel.queue).toHaveBeenCalledWith('occ-1', 'pass-1', 'schedule_boarding_reminder', expect.any(Object), expect.anything());
  });

  it('rejects redemption before code activation', async () => {
    lifecycleModel.lockByCode.mockResolvedValue({ ...openCode, valid_from: '2026-08-10T06:00:00.000Z' });
    await expect(service.redeem('ABC234', 'driver-1', now)).rejects.toThrow('not active yet');
    expect(busModel.reserveSeat).not.toHaveBeenCalled();
  });

  it('rejects redemption after expiry', async () => {
    lifecycleModel.lockByCode.mockResolvedValue({ ...openCode, valid_until: '2026-08-10T05:00:00.000Z' });
    await expect(service.redeem('ABC234', 'driver-1', now)).rejects.toThrow('expired');
    expect(busModel.reserveSeat).not.toHaveBeenCalled();
  });

  it('converts a future reservation into a boarded live booking exactly at scan', async () => {
    lifecycleModel.lockByCode.mockResolvedValue(openCode);
    busModel.reserveSeat.mockResolvedValue({ id: 'bus-1', seats_available: 4 });
    bookingModel.insert.mockResolvedValue({ id: 'booking-1' });
    lifecycleModel.markBoarded.mockResolvedValue({ id: 'occ-1', status: 'boarded' });
    codeModel.insert.mockResolvedValue({ id: 'ordinary-code-1' });
    codeModel.markUsed.mockResolvedValue({ status: 'used' });
    bookingModel.markBoarded.mockResolvedValue({ id: 'booking-1', boarded_at: now });

    const result = await service.redeem('ABC234', 'driver-1', now);
    expect(busModel.reserveSeat).toHaveBeenCalledWith('bus-1', expect.anything());
    expect(bookingModel.insert).toHaveBeenCalledWith(expect.objectContaining({
      status: 'confirmed', sourceOccurrenceId: 'occ-1', passengerId: 'pass-1',
    }), expect.anything());
    expect(result.booking.id).toBe('booking-1');
  });

  it('is idempotent when the same code is scanned twice', async () => {
    lifecycleModel.lockByCode.mockResolvedValue({ ...openCode, status: 'used', booking_id: 'booking-1' });
    bookingModel.findById.mockResolvedValue({ id: 'booking-1', boarded_at: now });
    await expect(service.redeem('ABC234', 'driver-1', now)).resolves.toMatchObject({ occurrenceId: 'occ-1' });
    expect(busModel.reserveSeat).not.toHaveBeenCalled();
    expect(bookingModel.insert).not.toHaveBeenCalled();
  });

  it('releases a future reservation through the atomic cancellation transition', async () => {
    lifecycleModel.cancel.mockResolvedValue({ id: 'occ-1', status: 'cancelled', passenger_id: 'pass-1', assigned_driver_id: 'driver-1', service_date: '2026-08-10' });
    await expect(service.cancel('occ-1', 'pass-1', now)).resolves.toMatchObject({ status: 'cancelled' });
    expect(lifecycleModel.cancel).toHaveBeenCalledWith('occ-1', 'pass-1', now, expect.anything());
  });

  it('records due no-shows without touching live-seat capacity', async () => {
    lifecycleModel.expireNoShows.mockResolvedValue([{ id: 'occ-1', status: 'expired', passenger_id: 'pass-1', assigned_driver_id: 'driver-1', service_date: '2026-08-10' }]);
    await expect(service.expireNoShows(now)).resolves.toHaveLength(1);
    expect(busModel.reserveSeat).not.toHaveBeenCalled();
  });
});
