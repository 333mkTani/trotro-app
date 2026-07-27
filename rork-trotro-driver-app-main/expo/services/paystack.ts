import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import api from './api';

/**
 * Wallet top-up via Paystack. The Paystack secret key never touches this
 * client — the backend calls Paystack's /transaction/initialize and
 * /transaction/verify directly (see backend/src/services/paystack.service.js)
 * and only credits the wallet after Paystack confirms the payment amount
 * server-side. This file just opens Paystack's hosted checkout page and
 * asks the backend to verify once the user returns.
 */
export async function payWithPaystack(
  amount: number,
  paymentMethod: string
): Promise<{ success: boolean; alreadyProcessed?: boolean }> {
  const callbackUrl = Linking.createURL('paystack-callback');

  const { data: init } = await api.post('/wallet/topup/initialize', {
    amount,
    paymentMethod,
    callbackUrl,
  });
  const { reference, authorizationUrl } = init as { reference: string; authorizationUrl: string };

  await WebBrowser.openAuthSessionAsync(authorizationUrl, callbackUrl);

  // The browser result only tells us the checkout page closed — the actual
  // payment outcome always comes from asking the backend to verify with
  // Paystack directly, so this call is what's authoritative either way.
  const { data: result } = await api.post('/wallet/topup/verify', { reference });
  return result as { success: boolean; alreadyProcessed?: boolean };
}
