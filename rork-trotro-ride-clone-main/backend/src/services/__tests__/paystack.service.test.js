process.env.PAYSTACK_SECRET_KEY = 'sk_test_dummy_key';

const crypto = require('crypto');
const paystackService = require('../paystack.service');

const jsonResponse = (body, ok = true) => ({ ok, json: async () => body });

describe('paystack.service', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
  });

  describe('verifyWebhookSignature', () => {
    const body = Buffer.from(JSON.stringify({ event: 'transfer.success', data: { reference: 'WD_1' } }));

    it('accepts a signature computed with the configured secret', () => {
      const validSig = crypto.createHmac('sha512', 'sk_test_dummy_key').update(body).digest('hex');
      expect(paystackService.verifyWebhookSignature(body, validSig)).toBe(true);
    });

    it('rejects a signature computed with the wrong secret', () => {
      const badSig = crypto.createHmac('sha512', 'someone-elses-key').update(body).digest('hex');
      expect(paystackService.verifyWebhookSignature(body, badSig)).toBe(false);
    });

    it('rejects when no signature header is present', () => {
      expect(paystackService.verifyWebhookSignature(body, undefined)).toBe(false);
    });
  });

  describe('verifyTransaction', () => {
    it('converts the amount from pesewas to GHS and reports success', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          status: true,
          data: {
            status: 'success',
            reference: 'TOPUP_1',
            amount: 5000,
            currency: 'GHS',
            channel: 'mobile_money',
            paid_at: '2026-01-01T00:00:00Z',
            gateway_response: 'Approved',
          },
        }),
      );

      const result = await paystackService.verifyTransaction('TOPUP_1');

      expect(result).toEqual({
        success: true,
        reference: 'TOPUP_1',
        amount: 50,
        currency: 'GHS',
        channel: 'mobile_money',
        paidAt: '2026-01-01T00:00:00Z',
        gatewayResponse: 'Approved',
      });
    });

    it('reports success: false for a non-success Paystack status without throwing', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({ status: true, data: { status: 'abandoned', amount: 100, currency: 'GHS' } }),
      );

      const result = await paystackService.verifyTransaction('TOPUP_2');
      expect(result.success).toBe(false);
    });

    it('throws with the Paystack error message when the API call itself fails', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({ status: false, message: 'Transaction reference not found' }, false),
      );

      await expect(paystackService.verifyTransaction('missing')).rejects.toThrow(
        'Transaction reference not found',
      );
    });
  });

  describe('getBanks', () => {
    it('fetches the Ghana bank list and serves repeat calls from cache', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(jsonResponse({ status: true, data: [{ name: 'MTN Mobile Money', code: 'MTN' }] }));
      global.fetch = fetchMock;

      const first = await paystackService.getBanks('mobile_money');
      const second = await paystackService.getBanks('mobile_money');

      expect(first).toEqual([{ name: 'MTN Mobile Money', code: 'MTN' }]);
      expect(second).toEqual(first);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('createTransferRecipient', () => {
    it('returns the recipient_code from a successful response', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({ status: true, data: { recipient_code: 'RCP_xyz' } }),
      );

      const code = await paystackService.createTransferRecipient({
        type: 'mobile_money',
        name: 'Kwame Mensah',
        accountNumber: '0244000000',
        bankCode: 'MTN',
      });

      expect(code).toBe('RCP_xyz');
    });

    it('throws with the Paystack error message on a bad account', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({ status: false, message: 'Invalid account number' }, false),
      );

      await expect(
        paystackService.createTransferRecipient({
          type: 'mobile_money',
          name: 'x',
          accountNumber: 'bad',
          bankCode: 'MTN',
        }),
      ).rejects.toThrow('Invalid account number');
    });
  });

  describe('initiateTransfer', () => {
    it('surfaces the raw Paystack transfer status instead of guessing completion', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({ status: true, data: { status: 'otp', transfer_code: 'TRF_abc' } }),
      );

      const result = await paystackService.initiateTransfer({
        amountPesewas: 1000,
        recipientCode: 'RCP_1',
        reason: 'Driver payout',
        reference: 'WD_1',
      });

      expect(result).toEqual({ status: 'otp', transferCode: 'TRF_abc' });
    });
  });

  describe('refunds', () => {
    it('creates a refund using pesewas and the original transaction reference', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({
        status: true, data: { id: 9001, status: 'pending', amount: 250 },
      }));
      const result = await paystackService.createRefund({
        transactionReference: 'DEP_1', amountPesewas: 250, merchantNote: 'Cancelled booking',
      });
      const request = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(request).toMatchObject({ transaction: 'DEP_1', amount: 250, currency: 'GHS' });
      expect(result).toMatchObject({ id: '9001', status: 'pending', amount: 2.5 });
    });

    it('reads the authoritative refund status for reconciliation', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({
        status: true, data: { id: 9001, status: 'processed', amount: 250,
          transaction: { reference: 'DEP_1' } },
      }));
      await expect(paystackService.getRefund('9001')).resolves.toEqual({
        id: '9001', status: 'processed', amount: 2.5, transactionReference: 'DEP_1',
      });
    });
  });

  describe('when PAYSTACK_SECRET_KEY is not configured', () => {
    it('refuses to call Paystack at all', async () => {
      const originalKey = process.env.PAYSTACK_SECRET_KEY;
      delete process.env.PAYSTACK_SECRET_KEY;
      global.fetch = jest.fn();

      await jest.isolateModulesAsync(async () => {
        const freshService = require('../paystack.service');
        await expect(freshService.verifyTransaction('ref')).rejects.toThrow(
          'Payment gateway is not configured',
        );
      });

      expect(global.fetch).not.toHaveBeenCalled();
      process.env.PAYSTACK_SECRET_KEY = originalKey;
    });
  });
});
