jest.mock('../../models/wallet.model');
jest.mock('../../models/profile.model');
jest.mock('../../models/booking.model');
jest.mock('../paystack.service');
jest.mock('../../config/db', () => ({
  // The real withTransaction runs fn against a locked pg client; tests don't
  // need real locking, just to run fn with *some* client stand-in.
  withTransaction: jest.fn((fn) => fn({ fakeClient: true })),
}));

const walletModel = require('../../models/wallet.model');
const bookingModel = require('../../models/booking.model');
const paystackService = require('../paystack.service');
const walletService = require('../wallet.service');

describe('charge', () => {
  const payableBooking = {
    id: 'booking-1', passenger_id: 'passenger-1', driver_id: 'driver-1',
    status: 'confirmed', arrived_at: new Date().toISOString(), code_status: 'used',
    authoritative_fare: '3.00', pickup_stop_name: 'Tech', destination_stop_name: 'Conti',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    bookingModel.findForPaymentForUpdate.mockResolvedValue(payableBooking);
    walletModel.findBookingTransactionForUpdate.mockResolvedValue(null);
    walletModel.ensureWallet.mockResolvedValue({ user_id: 'passenger-1', balance: '10.00' });
    walletModel.adjustBalance.mockResolvedValue({ user_id: 'passenger-1', balance: '7.00' });
    walletModel.insertTransaction.mockResolvedValue({ id: 'tx-1' });
  });

  it('debits the authoritative fare once and credits the assigned driver', async () => {
    await walletService.charge('passenger-1', { bookingId: 'booking-1', amount: 999 });
    expect(walletModel.adjustBalance).toHaveBeenNthCalledWith(1, 'passenger-1', -3, expect.anything());
    expect(walletModel.adjustBalance).toHaveBeenNthCalledWith(2, 'driver-1', 3, expect.anything());
    expect(walletModel.insertTransaction).toHaveBeenCalledTimes(2);
  });

  it('is idempotent when a completed ride payment already exists', async () => {
    walletModel.findBookingTransactionForUpdate.mockResolvedValue({ id: 'existing-debit' });
    walletModel.getBalance.mockResolvedValue({ user_id: 'passenger-1', balance: '7.00' });
    await walletService.charge('passenger-1', { bookingId: 'booking-1' });
    expect(walletModel.adjustBalance).not.toHaveBeenCalled();
    expect(walletModel.insertTransaction).not.toHaveBeenCalled();
  });

  it('rejects payment before boarding-code redemption', async () => {
    bookingModel.findForPaymentForUpdate.mockResolvedValue({ ...payableBooking, code_status: 'valid' });
    await expect(walletService.charge('passenger-1', { bookingId: 'booking-1' }))
      .rejects.toThrow('Boarding code must be redeemed');
  });
});

describe('requestWithdrawal', () => {
  const baseParams = {
    amount: 100,
    method: 'MOBILE_MONEY',
    accountNumber: '0244000000',
    accountName: 'Kwame Mensah',
    providerId: 'mtn',
  };

  it('rejects a non-positive amount before touching the wallet', async () => {
    await expect(walletService.requestWithdrawal('user-1', { ...baseParams, amount: 0 })).rejects.toThrow(
      'Amount must be positive',
    );
    expect(walletModel.ensureWallet).not.toHaveBeenCalled();
  });

  it('requires account details', async () => {
    await expect(
      walletService.requestWithdrawal('user-1', { ...baseParams, accountNumber: '' }),
    ).rejects.toThrow('Account details are required');
  });

  it('requires a mobile money provider for MOBILE_MONEY withdrawals', async () => {
    await expect(
      walletService.requestWithdrawal('user-1', { ...baseParams, providerId: undefined }),
    ).rejects.toThrow('Mobile money provider is required');
  });

  it('requires a bank code for BANK_TRANSFER withdrawals', async () => {
    await expect(
      walletService.requestWithdrawal('user-1', {
        ...baseParams,
        method: 'BANK_TRANSFER',
        providerId: undefined,
        bankCode: undefined,
      }),
    ).rejects.toThrow('Bank is required');
  });

  it('refuses to withdraw more than the current balance, without calling Paystack', async () => {
    walletModel.ensureWallet.mockResolvedValue({ balance: '50.00' });

    await expect(walletService.requestWithdrawal('user-1', baseParams)).rejects.toThrow(
      'Insufficient balance',
    );
    expect(paystackService.createTransferRecipient).not.toHaveBeenCalled();
  });

  it('debits the wallet and marks the transaction completed when Paystack confirms instantly', async () => {
    walletModel.ensureWallet.mockResolvedValue({ balance: '500.00' });
    walletModel.adjustBalance.mockResolvedValue({ balance: '400.00' });
    walletModel.insertTransaction.mockResolvedValue({ id: 'tx-1', status: 'pending' });
    walletModel.markTransactionStatus.mockResolvedValue({ id: 'tx-1', status: 'completed' });
    paystackService.getBanks.mockResolvedValue([{ name: 'MTN Mobile Money', code: 'MTN' }]);
    paystackService.createTransferRecipient.mockResolvedValue('RCP_1');
    paystackService.initiateTransfer.mockResolvedValue({ status: 'success', transferCode: 'TRF_1' });

    const result = await walletService.requestWithdrawal('user-1', baseParams);

    expect(walletModel.adjustBalance).toHaveBeenCalledWith('user-1', -100, expect.anything());
    expect(walletModel.markTransactionStatus).toHaveBeenCalledWith('tx-1', 'completed');
    expect(result).toMatchObject({ success: true, transaction: { status: 'completed' } });
  });

  it('leaves the transaction pending (no refund) when Paystack has not confirmed yet', async () => {
    walletModel.ensureWallet.mockResolvedValue({ balance: '500.00' });
    walletModel.adjustBalance.mockResolvedValue({ balance: '400.00' });
    walletModel.insertTransaction.mockResolvedValue({ id: 'tx-2', status: 'pending' });
    paystackService.getBanks.mockResolvedValue([{ name: 'MTN Mobile Money', code: 'MTN' }]);
    paystackService.createTransferRecipient.mockResolvedValue('RCP_2');
    paystackService.initiateTransfer.mockResolvedValue({ status: 'pending', transferCode: 'TRF_2' });

    const result = await walletService.requestWithdrawal('user-1', baseParams);

    expect(walletModel.markTransactionStatus).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, pending: true, transaction: { status: 'pending' } });
  });

  it('refunds the wallet and marks the transaction failed when Paystack rejects the transfer', async () => {
    walletModel.ensureWallet.mockResolvedValue({ balance: '500.00' });
    walletModel.adjustBalance
      .mockResolvedValueOnce({ balance: '400.00' }) // initial debit
      .mockResolvedValueOnce({ balance: '500.00' }); // refund
    walletModel.insertTransaction.mockResolvedValue({ id: 'tx-3', status: 'pending' });
    walletModel.markTransactionStatus.mockResolvedValue({ id: 'tx-3', status: 'failed' });
    paystackService.getBanks.mockResolvedValue([{ name: 'MTN Mobile Money', code: 'MTN' }]);
    paystackService.createTransferRecipient.mockRejectedValue(new Error('Invalid account number'));

    const result = await walletService.requestWithdrawal('user-1', baseParams);

    expect(walletModel.adjustBalance).toHaveBeenNthCalledWith(1, 'user-1', -100, expect.anything());
    expect(walletModel.adjustBalance).toHaveBeenNthCalledWith(2, 'user-1', 100, expect.anything());
    expect(walletModel.markTransactionStatus).toHaveBeenCalledWith('tx-3', 'failed', expect.anything());
    expect(result).toMatchObject({ success: false, message: 'Invalid account number' });
  });

  it('refunds the wallet when the mobile money provider cannot be resolved with Paystack', async () => {
    // resolveMomoBankCode runs inside the same try/catch as the Paystack
    // calls, after the debit — so this is a soft failure (refunded), not a
    // thrown validation error like the checks above.
    walletModel.ensureWallet.mockResolvedValue({ balance: '500.00' });
    walletModel.adjustBalance
      .mockResolvedValueOnce({ balance: '400.00' })
      .mockResolvedValueOnce({ balance: '500.00' });
    walletModel.insertTransaction.mockResolvedValue({ id: 'tx-9', status: 'pending' });
    walletModel.markTransactionStatus.mockResolvedValue({ id: 'tx-9', status: 'failed' });

    const result = await walletService.requestWithdrawal('user-1', {
      ...baseParams,
      providerId: 'unknown-provider',
    });

    expect(result).toMatchObject({ success: false, message: 'Unsupported mobile money provider' });
    expect(walletModel.adjustBalance).toHaveBeenNthCalledWith(2, 'user-1', 100, expect.anything());
    expect(paystackService.createTransferRecipient).not.toHaveBeenCalled();
  });
});

describe('listPayoutBanks', () => {
  it('excludes mobile-money channels, keeping only real banks', async () => {
    paystackService.getBanks.mockResolvedValue([
      { name: 'MTN Mobile Money', code: 'MTN' },
      { name: 'Vodafone Cash', code: 'VOD' },
      { name: 'AirtelTigo Money', code: 'ATL' },
      { name: 'GCB Bank', code: 'GCB' },
      { name: 'Ecobank Ghana', code: 'ECO' },
    ]);

    const banks = await walletService.listPayoutBanks();

    expect(banks).toEqual([
      { name: 'GCB Bank', code: 'GCB' },
      { name: 'Ecobank Ghana', code: 'ECO' },
    ]);
  });
});

describe('handleTransferWebhook', () => {
  it('ignores event types other than transfer.success/failed/reversed', async () => {
    await walletService.handleTransferWebhook({ event: 'charge.success', data: { reference: 'WD_1' } });
    expect(walletModel.findTransactionByReferenceOnly).not.toHaveBeenCalled();
  });

  it('ignores events with no reference', async () => {
    await walletService.handleTransferWebhook({ event: 'transfer.success', data: {} });
    expect(walletModel.findTransactionByReferenceOnly).not.toHaveBeenCalled();
  });

  it('is a no-op if the transaction was already finalized (idempotent replay)', async () => {
    walletModel.findTransactionByReferenceOnly.mockResolvedValue({
      id: 'tx-4',
      user_id: 'user-1',
      type: 'withdrawal',
      status: 'completed',
      amount: '-100',
    });

    await walletService.handleTransferWebhook({ event: 'transfer.success', data: { reference: 'WD_4' } });

    expect(walletModel.markTransactionStatus).not.toHaveBeenCalled();
    expect(walletModel.adjustBalance).not.toHaveBeenCalled();
  });

  it('is a no-op for transactions that are not withdrawals', async () => {
    walletModel.findTransactionByReferenceOnly.mockResolvedValue({
      id: 'tx-5',
      user_id: 'user-1',
      type: 'top_up',
      status: 'pending',
      amount: '100',
    });

    await walletService.handleTransferWebhook({ event: 'transfer.success', data: { reference: 'TOPUP_5' } });

    expect(walletModel.markTransactionStatus).not.toHaveBeenCalled();
  });

  it('marks a pending withdrawal completed on transfer.success', async () => {
    walletModel.findTransactionByReferenceOnly.mockResolvedValue({
      id: 'tx-6',
      user_id: 'user-1',
      type: 'withdrawal',
      status: 'pending',
      amount: '-100',
    });

    await walletService.handleTransferWebhook({ event: 'transfer.success', data: { reference: 'WD_6' } });

    expect(walletModel.markTransactionStatus).toHaveBeenCalledWith('tx-6', 'completed', expect.anything());
    expect(walletModel.adjustBalance).not.toHaveBeenCalled();
  });

  it('refunds the wallet and marks failed on transfer.failed', async () => {
    walletModel.findTransactionByReferenceOnly.mockResolvedValue({
      id: 'tx-7',
      user_id: 'user-1',
      type: 'withdrawal',
      status: 'pending',
      amount: '-100',
    });

    await walletService.handleTransferWebhook({ event: 'transfer.failed', data: { reference: 'WD_7' } });

    expect(walletModel.adjustBalance).toHaveBeenCalledWith('user-1', 100, expect.anything());
    expect(walletModel.markTransactionStatus).toHaveBeenCalledWith('tx-7', 'failed', expect.anything());
  });

  it('refunds the wallet and marks failed on transfer.reversed', async () => {
    walletModel.findTransactionByReferenceOnly.mockResolvedValue({
      id: 'tx-8',
      user_id: 'user-1',
      type: 'withdrawal',
      status: 'pending',
      amount: '-250',
    });

    await walletService.handleTransferWebhook({ event: 'transfer.reversed', data: { reference: 'WD_8' } });

    expect(walletModel.adjustBalance).toHaveBeenCalledWith('user-1', 250, expect.anything());
    expect(walletModel.markTransactionStatus).toHaveBeenCalledWith('tx-8', 'failed', expect.anything());
  });
});
