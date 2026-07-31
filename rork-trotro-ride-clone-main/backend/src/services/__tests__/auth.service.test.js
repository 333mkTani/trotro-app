jest.mock('../../models/profile.model');
jest.mock('../../models/wallet.model');
jest.mock('../../config/firebase');
jest.mock('../../config/db', () => ({
  // The real withTransaction runs fn against a locked pg client; tests don't
  // need real locking, just to run fn with *some* client stand-in that
  // resolves whatever query() is awaited on.
  withTransaction: jest.fn((fn) =>
    fn({ query: jest.fn().mockResolvedValue({ rows: [{ id: 'user-1', phone: '+233555000111' }] }) }),
  ),
}));

const profileModel = require('../../models/profile.model');
const walletModel = require('../../models/wallet.model');
const { getAdmin } = require('../../config/firebase');
const authService = require('../auth.service');

describe('registerWithVerifiedPhone', () => {
  const basePayload = {
    idToken: 'valid-id-token',
    fullName: 'Kwame Mensah',
    password: 'supersecret',
    role: 'passenger',
  };

  const mockAdmin = (verifyIdToken) => {
    getAdmin.mockReturnValue({ auth: () => ({ verifyIdToken }) });
  };

  it('creates the account when the Firebase ID token is valid and the phone is new', async () => {
    mockAdmin(jest.fn().mockResolvedValue({ phone_number: '+233555000111' }));
    profileModel.findByPhone.mockResolvedValue(null);
    walletModel.ensureWallet.mockResolvedValue({ balance: '0.00' });

    const result = await authService.registerWithVerifiedPhone(basePayload);

    expect(profileModel.findByPhone).toHaveBeenCalledWith('+233555000111');
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('token');
  });

  it('rejects when Firebase Admin is not configured', async () => {
    getAdmin.mockReturnValue(null);

    await expect(authService.registerWithVerifiedPhone(basePayload)).rejects.toThrow(
      'Phone verification is not configured',
    );
  });

  it('rejects an invalid or expired ID token', async () => {
    mockAdmin(jest.fn().mockRejectedValue(new Error('Decoding Firebase ID token failed')));

    await expect(authService.registerWithVerifiedPhone(basePayload)).rejects.toThrow(
      'Phone verification expired or invalid — verify again',
    );
    expect(profileModel.findByPhone).not.toHaveBeenCalled();
  });

  it('rejects a token with no verified phone number claim', async () => {
    mockAdmin(jest.fn().mockResolvedValue({ uid: 'firebase-uid-only' }));

    await expect(authService.registerWithVerifiedPhone(basePayload)).rejects.toThrow(
      'Token has no verified phone number',
    );
  });

  it('rejects if the verified phone number is already registered', async () => {
    mockAdmin(jest.fn().mockResolvedValue({ phone_number: '+233555000111' }));
    profileModel.findByPhone.mockResolvedValue({ id: 'existing-user' });

    await expect(authService.registerWithVerifiedPhone(basePayload)).rejects.toThrow(
      'Phone already registered',
    );
  });
});
