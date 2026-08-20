jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiGet: jest.fn(),
  multiRemove: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/store/authStore';

const secureStorage = SecureStore as jest.Mocked<typeof SecureStore>;

describe('driver auth persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    secureStorage.getItemAsync.mockResolvedValue(null);
    secureStorage.setItemAsync.mockResolvedValue(undefined);
    secureStorage.deleteItemAsync.mockResolvedValue(undefined);
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });
  });

  it('restores a backend session that has an access token without a refresh token', async () => {
    secureStorage.getItemAsync
      .mockResolvedValueOnce(JSON.stringify({ accessToken: 'jwt-token', refreshToken: null }))
      .mockResolvedValueOnce(JSON.stringify({ id: 'driver-1', role: 'driver' }));

    await useAuthStore.getState().loadStoredAuth();

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'jwt-token',
      refreshToken: null,
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('waits for secure token persistence before marking the session authenticated', async () => {
    let finishWrite!: () => void;
    secureStorage.setItemAsync.mockImplementation(() => new Promise<void>((resolve) => {
      finishWrite = resolve;
    }));

    const persistence = useAuthStore.getState().setTokens('jwt-token');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    finishWrite();
    await persistence;

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'jwt-token',
      refreshToken: null,
      isAuthenticated: true,
    });
  });
});
