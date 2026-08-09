jest.mock('../../models/scheduleOccurrence.model');

const model = require('../../models/scheduleOccurrence.model');
const service = require('../driverSchedule.service');

describe('driver scheduled request service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns future requests with model-computed capacity', async () => {
    model.listForDriver.mockResolvedValue([{ id: 'occ-1', future_seats_remaining: 3 }]);
    await expect(service.listRequests('driver-1')).resolves.toEqual([
      { id: 'occ-1', future_seats_remaining: 3 },
    ]);
  });

  it('returns terminal history scoped by the model', async () => {
    model.listHistoryForDriver.mockResolvedValue([{ id: 'occ-old', status: 'completed' }]);
    await expect(service.listHistory('driver-1')).resolves.toEqual([
      { id: 'occ-old', status: 'completed' },
    ]);
    expect(model.listHistoryForDriver).toHaveBeenCalledWith('driver-1');
  });

  it('returns an authorized occurrence detail', async () => {
    model.findForDriver.mockResolvedValue({ id: 'occ-1', status: 'accepted' });
    await expect(service.getRequest('occ-1', 'driver-1'))
      .resolves.toMatchObject({ id: 'occ-1' });
    expect(model.findForDriver).toHaveBeenCalledWith('occ-1', 'driver-1');
  });

  it('does not reveal an occurrence outside the driver scope', async () => {
    model.findForDriver.mockResolvedValue(null);
    await expect(service.getRequest('occ-private', 'driver-1'))
      .rejects.toMatchObject({ status: 404, message: 'Scheduled request not found' });
  });

  it('returns an already-accepted response idempotently', async () => {
    model.acceptAtomic.mockResolvedValue({ occurrence: { id: 'occ-1' }, alreadyAccepted: true });
    await expect(service.accept('occ-1', 'driver-1')).resolves.toMatchObject({ alreadyAccepted: true });
  });

  it.each([
    ['ALREADY_ASSIGNED', 409],
    ['FULL', 409],
    ['WRONG_ROUTE', 403],
    ['DEADLINE_PASSED', 400],
  ])('maps %s safely to HTTP %s', async (error, status) => {
    model.acceptAtomic.mockResolvedValue({ error });
    await expect(service.accept('occ-1', 'driver-1')).rejects.toMatchObject({ status });
  });

  it('returns HTTP 409 when future capacity is exhausted', async () => {
    model.acceptAtomic.mockResolvedValue({ error: 'FULL' });
    await expect(service.accept('occ-1', 'driver-1')).rejects.toMatchObject({ status: 409 });
  });

  it('records an eligible decline', async () => {
    model.decline.mockResolvedValue({ occurrence_id: 'occ-1', response: 'declined' });
    await expect(service.decline('occ-1', 'driver-1', 'Not operating tomorrow'))
      .resolves.toMatchObject({ response: 'declined' });
  });

  it('rejects decline attempts for unavailable or wrong-route requests', async () => {
    model.decline.mockResolvedValue(null);
    await expect(service.decline('occ-1', 'driver-1')).rejects.toMatchObject({ status: 400 });
  });

  it('reopens a request when the assigned driver withdraws before boarding', async () => {
    model.withdrawAtomic.mockResolvedValue({ occurrence: { id: 'occ-1', status: 'offered' } });
    await expect(service.withdraw('occ-1', 'driver-1', 'Bus maintenance'))
      .resolves.toMatchObject({ occurrence: { status: 'offered' } });
  });

  it('blocks ordinary withdrawal once boarding has opened', async () => {
    model.withdrawAtomic.mockResolvedValue({ error: 'BOARDING_OPEN' });
    await expect(service.withdraw('occ-1', 'driver-1')).rejects.toMatchObject({ status: 400 });
  });
});
