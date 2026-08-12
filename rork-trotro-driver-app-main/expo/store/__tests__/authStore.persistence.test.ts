jest.mock('@react-native-async-storage/async-storage', () => ({
  multiGet: jest.fn(),
  setItem: jest.fn(),
  multiRemove: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/authStore';

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('driver auth persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });
  });

  it('restores a backend session that has an access token without a refresh token', async () => {
    storage.multiGet.mockResolvedValue([
      ['auth_tokens', JSON.stringify({ accessToken: 'jwt-token', refreshToken: null })],
      ['auth_user', JSON.stringify({ id: 'driver-1', role: 'driver' })],
    ]);

    await useAuthStore.getState().loadStoredAuth();

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'jwt-token',
      refreshToken: null,
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('waits for token persistence before marking the session authenticated', async () => {
    let finishWrite!: () => void;
    storage.setItem.mockImplementation(() => new Promise<void>((resolve) => {
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
