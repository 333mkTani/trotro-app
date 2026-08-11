jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));
jest.mock('@/store/driverStore', () => ({
  useDriverStore: { getState: jest.fn(() => ({})) },
}));

import api from '../api';
import { getTransactions } from '../driverApi';

describe('driver wallet transaction mapping', () => {
  it('preserves no-show compensation as a distinct earning type', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: [{
      id: 'tx-1', type: 'no_show_compensation', amount: '2.50',
      description: 'No-show compensation', status: 'completed',
      created_at: '2026-08-12T08:10:00Z', reference: 'NOSHOW_1_CREDIT',
    }] });

    await expect(getTransactions()).resolves.toEqual([expect.objectContaining({
      type: 'NO_SHOW_COMPENSATION', amount: 2.5, status: 'COMPLETED',
    })]);
  });
});
