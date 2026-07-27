const { asyncHandler } = require('../utils/asyncHandler');
const paystackService = require('../services/paystack.service');
const walletService = require('../services/wallet.service');

// Paystack requires a fast 2xx ack and retries on failure/timeout — we ack
// first, then process. handleTransferWebhook is idempotent so a retried
// delivery (or one that arrives after we've already acked) is safe.
const handlePaystackWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-paystack-signature'];

  if (!req.rawBody || !paystackService.verifyWebhookSignature(req.rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  res.status(200).json({ received: true });

  try {
    await walletService.handleTransferWebhook(req.body);
  } catch (err) {
    console.error('[webhook] failed to process Paystack event', err);
  }
});

module.exports = { handlePaystackWebhook };
