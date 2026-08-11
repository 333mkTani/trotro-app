const { asyncHandler } = require('../utils/asyncHandler');
const paystackService = require('../services/paystack.service');
const walletService = require('../services/wallet.service');
const bookingPaymentService = require('../services/bookingPayment.service');
const refundService = require('../services/refund.service');

// Paystack requires a fast 2xx ack and retries on failure/timeout — we ack
// only after durable processing. Both handlers are idempotent, so Paystack
// can safely retry when provider verification or a database operation fails.
const handlePaystackWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-paystack-signature'];

  if (!req.rawBody || !paystackService.verifyWebhookSignature(req.rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  await walletService.handleTransferWebhook(req.body);
  await refundService.handleWebhook(req.body);
  await bookingPaymentService.handleWebhook(req.body);
  res.status(200).json({ received: true });
});

module.exports = { handlePaystackWebhook };
