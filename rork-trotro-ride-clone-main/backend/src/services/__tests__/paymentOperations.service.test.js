jest.mock('../../models/booking.model');
jest.mock('../../models/bookingPayment.model');
jest.mock('../../models/wallet.model');
jest.mock('../../models/paymentReconciliation.model');
jest.mock('../refund.service');

const bookingModel = require('../../models/booking.model');
const paymentModel = require('../../models/bookingPayment.model');
const walletModel = require('../../models/wallet.model');
const reconciliationModel = require('../../models/paymentReconciliation.model');
const service = require('../paymentOperations.service');

describe('admin payment tracing', () => {
  it('returns lifecycle, provider, wallet and reconciliation records together', async () => {
    bookingModel.findById.mockResolvedValue({
      id: 'booking-1', payment_status: 'refunded', deposit_amount: '2.50',
      remaining_balance: '7.50', no_show_compensated_at: null,
    });
    paymentModel.listForBooking.mockResolvedValue([
      { type: 'deposit', status: 'succeeded', amount: '2.50' },
      { type: 'refund', status: 'succeeded', amount: '2.50' },
      { type: 'no_show_compensation', status: 'succeeded', amount: '2.50' },
    ]);
    walletModel.listForBooking.mockResolvedValue([]);
    reconciliationModel.listForBooking.mockResolvedValue([{ outcome: 'processed' }]);
    const trace = await service.trace('booking-1');
    expect(trace).toMatchObject({
      summary: { paymentStatus: 'refunded', netProviderCollections: 0 },
      reconciliationEvents: [{ outcome: 'processed' }],
    });
  });
});
