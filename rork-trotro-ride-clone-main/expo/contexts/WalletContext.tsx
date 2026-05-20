import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { WalletTransaction, TransactionType, TransactionStatus, PaymentMethod } from '@/types';
import { api } from '@/services/api';

const METHOD_LABELS: Record<string, string> = {
  momo_mtn: 'MTN Mobile Money',
  momo_vodafone: 'Vodafone Cash',
  momo_airteltigo: 'AirtelTigo Money',
  card: 'Debit/Credit Card',
  bank: 'Bank Transfer',
};

// Backend uses 'topup'/'debit'/'credit' — map to frontend TransactionType
const mapType = (t: string): TransactionType => {
  if (t === 'topup') return 'top_up';
  if (t === 'debit') return 'ride_payment';
  if (t === 'credit') return 'refund';
  return t as TransactionType;
};

const mapTxn = (t: Record<string, unknown>): WalletTransaction => ({
  id: t.id as string,
  type: mapType(t.type as string),
  amount: parseFloat(t.amount as string),
  description: t.description as string,
  status: (t.status ?? 'completed') as TransactionStatus,
  payment_method: t.payment_method as PaymentMethod | undefined,
  reference: t.reference as string | undefined,
  created_at: t.created_at as string,
});

export const [WalletProvider, useWallet] = createContextHook(() => {
  const queryClient = useQueryClient();

  const walletQuery = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const [balRes, txnRes] = await Promise.all([
        api.get('/wallet'),
        api.get('/wallet/transactions'),
      ]);
      return {
        balance: parseFloat(balRes.data.balance),
        transactions: (txnRes.data as Record<string, unknown>[]).map(mapTxn),
      };
    },
  });

  const balance = walletQuery.data?.balance ?? 0;
  const transactions = walletQuery.data?.transactions ?? [];

  const topUpMutation = useMutation({
    mutationFn: async ({
      amount,
      paymentMethod,
    }: {
      amount: number;
      paymentMethod: PaymentMethod;
    }): Promise<WalletTransaction> => {
      const { data } = await api.post('/wallet/topup', {
        amount,
        paymentMethod: METHOD_LABELS[paymentMethod] ?? paymentMethod,
      });
      return mapTxn(data as Record<string, unknown>);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallet'] }),
  });

  const payDriverMutation = useMutation({
    mutationFn: async ({
      amount,
      description,
    }: {
      amount: number;
      description: string;
      driverName: string;
    }): Promise<WalletTransaction> => {
      const { data } = await api.post('/wallet/charge', { amount, description });
      return mapTxn(data as Record<string, unknown>);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallet'] }),
  });

  const recentTransactions = useMemo(() => transactions.slice(0, 20), [transactions]);

  return {
    balance,
    transactions,
    recentTransactions,
    topUp: topUpMutation.mutateAsync,
    topUpPending: topUpMutation.isPending,
    payDriver: payDriverMutation.mutateAsync,
    payDriverPending: payDriverMutation.isPending,
    isLoading: walletQuery.isLoading,
  };
});
