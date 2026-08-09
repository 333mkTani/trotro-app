jest.mock('../../models/commuterSchedule.model');
jest.mock('../../models/scheduleNotification.model');
jest.mock('../../config/db', () => ({ withTransaction: jest.fn((fn) => fn({ query: jest.fn() })) }));
jest.mock('../../utils/clock', () => ({ now: jest.fn(() => new Date('2026-08-09T12:00:00Z')) }));
jest.mock('../../config/scheduleRollout', () => ({ isScheduledReservationsEnabled: jest.fn(() => true) }));

const model = require('../../models/commuterSchedule.model');
const notificationModel = require('../../models/scheduleNotification.model');
const service = require('../commuterSchedule.service');

describe('commuterSchedule service', () => {
  const passenger = { id: 'passenger-1', role: 'passenger' };
  const schedule = {
    id: 'schedule-1', passenger_id: passenger.id, status: 'active',
    departure_stop_id: 'stop-1', destination_stop_id: 'stop-2',
    boarding_start_local: '06:00:00', boarding_end_local: '06:30:00',
  };

  beforeEach(() => jest.clearAllMocks());

  it('creates a schedule for the authenticated passenger', async () => {
    model.insert.mockResolvedValue(schedule);
    const data = { routeId: 'route-1' };
    await expect(service.create(passenger.id, data)).resolves.toEqual(schedule);
    expect(model.insert).toHaveBeenCalledWith(passenger.id, data);
  });

  it('rejects access to another passenger schedule', async () => {
    model.findById.mockResolvedValue({ ...schedule, passenger_id: 'someone-else' });
    await expect(service.getOwned(schedule.id, passenger)).rejects.toMatchObject({ status: 403 });
  });

  it('rejects an update whose merged boarding window is invalid', async () => {
    model.findById.mockResolvedValue(schedule);
    await expect(service.update(schedule.id, passenger, { boardingStartLocal: '07:00' }))
      .rejects.toThrow('Boarding window must end after it starts');
    expect(model.update).not.toHaveBeenCalled();
  });

  it('deletes a schedule, cancels its future occurrences, and notifies an assigned driver', async () => {
    model.findById.mockResolvedValue(schedule);
    model.removeAndCancelFuture.mockResolvedValue({
      schedule: { ...schedule, status: 'deleted' },
      occurrences: [{ id: 'occ-1', passenger_id: passenger.id, assigned_driver_id: 'driver-1', service_date: '2026-08-10' }],
    });
    await expect(service.remove(schedule.id, passenger))
      .resolves.toEqual({ ok: true, cancelledOccurrences: 1 });
    expect(notificationModel.queue).toHaveBeenCalledWith(
      'occ-1', 'driver-1', 'schedule_cancelled',
      expect.objectContaining({ audience: 'driver' }), expect.anything(),
    );
  });

  it('lists occurrences only after ownership is checked', async () => {
    model.findById.mockResolvedValue(schedule);
    model.listOccurrences.mockResolvedValue([{ id: 'occurrence-1' }]);
    await expect(service.listOccurrences(schedule.id, passenger)).resolves.toHaveLength(1);
    expect(model.listOccurrences).toHaveBeenCalledWith(schedule.id, passenger.id);
  });
});
