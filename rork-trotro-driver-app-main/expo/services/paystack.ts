import { PaystackInitResponse, PaystackVerifyResponse } from '@/types';

const PAYSTACK_PUBLIC_KEY = process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || '';
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export function getPaystackPublicKey(): string {
  return PAYSTACK_PUBLIC_KEY;
}

export async function initializePaystackTransaction(
  email: string,
  amountInPesewas: number,
  reference: string,
  metadata?: Record<string, unknown>
): Promise<PaystackInitResponse> {
  console.log('[Paystack] Initializing transaction:', { email, amountInPesewas, reference });

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.EXPO_PUBLIC_PAYSTACK_SECRET_KEY || ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: amountInPesewas,
      currency: 'GHS',
      reference,
      metadata: {
        ...metadata,
        custom_fields: [
          { display_name: 'Wallet Funding', variable_name: 'wallet_funding', value: 'true' },
        ],
      },
      callback_url: 'https://rork.app/paystack/callback',
    }),
  });

  const data = await response.json();
  if (!data.status) {
    throw new Error(data.message || 'Failed to initialize payment');
  }

  console.log('[Paystack] Transaction initialized:', data.data.reference);
  return data.data;
}

export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerifyResponse> {
  console.log('[Paystack] Verifying transaction:', reference);

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    headers: {
      'Authorization': `Bearer ${process.env.EXPO_PUBLIC_PAYSTACK_SECRET_KEY || ''}`,
    },
  });

  const data = await response.json();
  if (!data.status) {
    throw new Error(data.message || 'Verification failed');
  }

  console.log('[Paystack] Verification result:', data.data.status);
  return {
    status: data.data.status === 'success',
    reference: data.data.reference,
    amount: data.data.amount / 100,
    currency: data.data.currency,
    channel: data.data.channel,
  };
}

export function generatePaystackReference(): string {
  return `PS_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function buildPaystackInlineHTML(
  publicKey: string,
  email: string,
  amountInPesewas: number,
  reference: string,
  currency: string = 'GHS'
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #F5F9F9;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
        }
        .loading {
          text-align: center;
          color: #64748B;
          font-size: 16px;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #E2E8F0;
          border-top-color: #1565C0;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 16px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <div class="loading">
        <div class="spinner"></div>
        <p>Initializing payment...</p>
      </div>
      <script src="https://js.paystack.co/v2/inline.js"></script>
      <script>
        try {
          const popup = new PaystackPop();
          popup.newTransaction({
            key: '${publicKey}',
            email: '${email}',
            amount: ${amountInPesewas},
            currency: '${currency}',
            ref: '${reference}',
            onSuccess: function(transaction) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                event: 'success',
                reference: transaction.reference,
                message: transaction.message
              }));
            },
            onCancel: function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                event: 'cancelled'
              }));
            },
            onLoad: function(response) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                event: 'loaded'
              }));
            }
          });
        } catch(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            event: 'error',
            message: e.message || 'Failed to load payment'
          }));
        }
      </script>
    </body>
    </html>
  `;
}
