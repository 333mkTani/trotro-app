jest.mock('../../models/stop.model');
jest.mock('../cache.service', () => ({ wrap: jest.fn(), del: jest.fn().mockResolvedValue(undefined) }));

const stopModel = require('../../models/stop.model');
const cache = require('../cache.service');
const service = require('../stop.service');

describe('admin stop archival', () => {
  beforeEach(() => jest.clearAllMocks());

  it('blocks deletion while the stop has active references', async () => {
    stopModel.findById.mockResolvedValue({ id: 'stop-1', name: 'Stairs', status: 'active' });
    stopModel.activeReferences.mockResolvedValue({ routes: 1, schedules: 0, departure_slots: 0, alerts: 0 });

    await expect(service.archive('stop-1')).rejects.toMatchObject({ status: 409 });
    expect(stopModel.archive).not.toHaveBeenCalled();
  });

  it('archives an unused stop and invalidates its caches', async () => {
    const stop = { id: 'stop-1', name: 'Stairs', status: 'active' };
    stopModel.findById.mockResolvedValue(stop);
    stopModel.activeReferences.mockResolvedValue({ routes: 0, schedules: 0, departure_slots: 0, alerts: 0 });
    stopModel.archive.mockResolvedValue({ ...stop, status: 'deleted' });

    await expect(service.archive('stop-1')).resolves.toMatchObject({ status: 'deleted' });
    expect(stopModel.archive).toHaveBeenCalledWith('stop-1');
    expect(cache.del).toHaveBeenCalledWith('stops:list:active');
    expect(cache.del).toHaveBeenCalledWith('stops:item:stop-1');
  });
});

describe('admin stop editing', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates an active stop and invalidates its list and item caches', async () => {
    const existing = { id: 'stop-1', name: 'Old name', status: 'active' };
    const updated = { ...existing, name: 'New name', lat: 6.67, lng: -1.57 };
    stopModel.findById.mockResolvedValue(existing);
    stopModel.update.mockResolvedValue(updated);

    await expect(service.update('stop-1', { name: 'New name', lat: 6.67, lng: -1.57 }))
      .resolves.toEqual(updated);
    expect(stopModel.update).toHaveBeenCalledWith(
      'stop-1', { name: 'New name', lat: 6.67, lng: -1.57 },
    );
    expect(cache.del).toHaveBeenCalledWith('stops:list:active');
    expect(cache.del).toHaveBeenCalledWith('stops:item:stop-1');
  });

  it('refuses to edit a deleted stop', async () => {
    stopModel.findById.mockResolvedValue({ id: 'stop-1', status: 'deleted' });
    await expect(service.update('stop-1', { name: 'Nope' })).rejects.toMatchObject({ status: 404 });
    expect(stopModel.update).not.toHaveBeenCalled();
  });
});
