jest.mock('../../services/routing.service', () => ({
  getDirections: jest.fn(),
}));

const routingService = require('../../services/routing.service');
const controller = require('../routing.controller');

const run = async (handler, req, res, next) => {
  handler(req, res, next);
  await new Promise((resolve) => setImmediate(resolve));
};

describe('routing.controller', () => {
  it('passes the validated query to the service and returns its response', async () => {
    const query = {
      originLat: 5.6037,
      originLng: -0.1969,
      destinationLat: 5.6148,
      destinationLng: -0.187,
      profile: 'walking',
      steps: true,
    };
    const route = { provider: 'mapbox', distanceMeters: 1200 };
    routingService.getDirections.mockResolvedValue(route);
    const res = { json: jest.fn() };
    const next = jest.fn();

    await run(controller.directions, { query }, res, next);

    expect(routingService.getDirections).toHaveBeenCalledWith(query);
    expect(res.json).toHaveBeenCalledWith(route);
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards service failures to error middleware', async () => {
    const error = new Error('provider failed');
    routingService.getDirections.mockRejectedValue(error);
    const next = jest.fn();

    await run(controller.directions, { query: {} }, { json: jest.fn() }, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
