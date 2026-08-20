const mockSecureStore = {
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
};
const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
};

jest.doMock('expo-secure-store', () => mockSecureStore);
jest.doMock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

const storage = require('@/services/secureAuthStorage') as typeof import('@/services/secureAuthStorage');

describe('driver secure auth storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    mockAsyncStorage.getItem.mockResolvedValue(null);
  });

  it('stores tokens and profiles in SecureStore, not AsyncStorage', async () => {
    await storage.setTokens({ accessToken: 'jwt-token', refreshToken: null });
    await storage.setProfile({ id: 'driver-1', role: 'driver' });

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      'trotro.auth.tokens.v1',
      JSON.stringify({ accessToken: 'jwt-token', refreshToken: null }),
    );
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      'trotro.auth.profile.v1',
      JSON.stringify({ id: 'driver-1', role: 'driver' }),
    );
    expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('migrates legacy tokens and profile once', async () => {
    mockAsyncStorage.getItem
      .mockResolvedValueOnce(JSON.stringify({ accessToken: 'legacy-token', refreshToken: null }))
      .mockResolvedValueOnce(JSON.stringify({ id: 'driver-1', role: 'driver' }));

    await expect(storage.getTokens()).resolves.toEqual({ accessToken: 'legacy-token', refreshToken: null });
    await expect(storage.getProfile<{ id: string }>()).resolves.toEqual({ id: 'driver-1', role: 'driver' });
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('auth_tokens');
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('auth_user');
  });

  it('deletes secure credentials and legacy keys on cleanup', async () => {
    await storage.clearTokens();
    await storage.clearProfile();

    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('trotro.auth.tokens.v1');
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('trotro.auth.profile.v1');
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('auth_tokens');
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('auth_user');
  });
});
