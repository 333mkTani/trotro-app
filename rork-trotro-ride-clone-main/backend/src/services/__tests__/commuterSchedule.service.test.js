jest.mock('../../models/commuterSchedule.model');
jest.mock('../../models/scheduleNotification.model');
jest.mock('../../models/departureSlot.model');
jest.mock('../../config/db', () => ({ withTransaction: jest.fn((fn) => fn({ query: jest.fn() })) }));
jest.mock('../../utils/clock', () => ({ now: jest.fn(() => new Date('2026-08-09T12:00:00Z')) }));
jest.mock('../../config/scheduleRollout', () => ({ isScheduledReservationsEnabled: jest.fn(() => true) }));

const model = require('../../models/commuterSchedule.model');
const notificationModel = require('../../models/scheduleNotification.model');
const departureSlotModel = require('../../models/departureSlot.model');
const service = require('../commuterSchedule.service');

describe('commuterSchedule service', () => {
  const passenger = { id: 'passenger-1', role: 'passenger' };
  const schedule = {
    id: 'schedule-1', passenger_id: passenger.id, status: 'active', route_id: 'route-1',
    departure_stop_id: 'stop-1', destination_stop_id: 'stop-2',
    boarding_start_local: '06:00:00', boarding_end_local: '06:30:00',
  };

  beforeEach(() => jest.clearAllMocks());

  it('creates a schedule for the authenticated passenger', async () => {
    model.insert.mockResolvedValue(schedule);
    departureSlotModel.findActiveById.mockResolvedValue({
      id: 'slot-1', route_id: 'route-1', departure_stop_id: 'stop-1', destination_stop_id: 'stop-2',
      travel_days: ['mon'], boarding_start_local: '06:00:00', boarding_end_local: '06:30:00', timezone: 'Africa/Accra',
    });
    const data = { routeId: 'route-1', departureStopId: 'stop-1', destinationStopId: 'stop-2',
      departureSlotId: 'slot-1', travelDays: ['mon'] };
    await expect(service.create(passenger.id, data)).resolves.toEqual(schedule);
    expect(model.insert).toHaveBeenCalledWith(passenger.id, expect.objectContaining({
      ...data, boardingStartLocal: '06:00', boardingEndLocal: '06:30', timezone: 'Africa/Accra',
    }));
  });

  it('rejects access to another passenger schedule', async () => {
    model.findById.mockResolvedValue({ ...schedule, passenger_id: 'someone-else' });
    await expect(service.getOwned(schedule.id, passenger)).rejects.toMatchObject({ status: 403 });
  });

  it('rejects an update to a slot that does not match the schedule route', async () => {
    model.findById.mockResolvedValue(schedule);
    departureSlotModel.findActiveById.mockResolvedValue({
      id: 'slot-2', route_id: 'other-route', departure_stop_id: 'stop-1', destination_stop_id: 'stop-2',
      travel_days: ['mon'], boarding_start_local: '07:00:00', boarding_end_local: '07:30:00',
    });
    await expect(service.update(schedule.id, passenger, { departureSlotId: 'slot-2', travelDays: ['mon'] }))
      .rejects.toThrow('Selected departure slot does not match');
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
