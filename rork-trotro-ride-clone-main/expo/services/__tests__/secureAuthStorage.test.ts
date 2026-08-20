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

describe('passenger secure auth storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    mockAsyncStorage.getItem.mockResolvedValue(null);
  });

  it('stores tokens and profiles in SecureStore, not AsyncStorage', async () => {
    await storage.setAccessToken('jwt-token');
    await storage.setProfile({ id: 'passenger-1' });

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('trotro.auth.access_token.v1', 'jwt-token');
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('trotro.auth.profile.v1', JSON.stringify({ id: 'passenger-1' }));
    expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('migrates a legacy token and profile once', async () => {
    mockAsyncStorage.getItem
      .mockResolvedValueOnce('legacy-token')
      .mockResolvedValueOnce(JSON.stringify({ id: 'passenger-1' }));

    await expect(storage.getAccessToken()).resolves.toBe('legacy-token');
    await expect(storage.getProfile<{ id: string }>()).resolves.toEqual({ id: 'passenger-1' });
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('auth_token');
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('trotro_auth_profile');
  });

  it('deletes secure credentials and legacy keys on cleanup', async () => {
    await storage.clearAccessToken();
    await storage.clearProfile();

    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('trotro.auth.access_token.v1');
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('trotro.auth.profile.v1');
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('auth_token');
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('trotro_auth_profile');
  });
});
