const bookingModel = require('../models/booking.model');
const paymentModel = require('../models/bookingPayment.model');
const walletModel = require('../models/wallet.model');
const reconciliationModel = require('../models/paymentReconciliation.model');
const refundService = require('./refund.service');
const { ApiError } = require('../utils/ApiError');

const trace = async (bookingId) => {
  const booking = await bookingModel.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  const [payments, walletTransactions, reconciliationEvents] = await Promise.all([
    paymentModel.listForBooking(bookingId),
    walletModel.listForBooking(bookingId),
    reconciliationModel.listForBooking(bookingId),
  ]);
  return {
    booking,
    payments,
    walletTransactions,
    reconciliationEvents,
    summary: {
      paymentStatus: booking.payment_status,
      deposit: Number(booking.deposit_amount || 0),
      remainingBalance: Number(booking.remaining_balance || 0),
      refundPending: booking.payment_status === 'refund_pending',
      noShowCompensated: Boolean(booking.no_show_compensated_at),
      netProviderCollections: payments
        .filter((p) => p.status === 'succeeded' && ['deposit', 'balance', 'refund'].includes(p.type))
        .reduce((sum, p) => sum + (p.type === 'refund' ? -1 : 1) * Number(p.amount), 0),
    },
  };
};

const reconcile = async (bookingId) => {
  const result = await refundService.reconcileBooking(bookingId);
  return { result, trace: await trace(bookingId) };
};

module.exports = { trace, reconcile };
