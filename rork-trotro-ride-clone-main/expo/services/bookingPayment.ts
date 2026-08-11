import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { api } from './api';
import type { ApproachingBus, Booking, BufferMinutes } from '@/types';

export interface ProvisionalBookingInput {
  bus: ApproachingBus;
  routeId: string;
  routeName: string;
  pickupStopId: string;
  pickupStopName: string;
  destinationStopId: string;
  destinationStopName: string;
  bufferMinutes: BufferMinutes;
}

export interface ProvisionalBookingResult {
  booking: Booking;
  payment: {
    currency: 'GHS';
    totalFare: number;
    depositAmount: number;
    remainingBalance: number;
    status: 'deposit_pending';
    holdExpiresAt: string;
  };
  reused?: boolean;
}

export interface DepositVerificationResult {
  success: boolean;
  reserved: boolean;
  refundPending: boolean;
  alreadyProcessed?: boolean;
  booking?: Booking;
  code?: { code: string; valid_until?: string; qr_payload?: string };
}

export async function createProvisionalBooking(
  input: ProvisionalBookingInput,
): Promise<ProvisionalBookingResult> {
  if (!input.bus.bus_id) throw new Error('The selected bus identifier is missing');
  const arrivalTime = new Date(Date.now() + input.bus.eta_minutes * 60 * 1000).toISOString();
  const { data } = await api.post('/bookings/provisional', {
    routeId: input.routeId,
    busId: input.bus.bus_id,
    driverId: input.bus.driver_id,
    pickupStopId: input.pickupStopId,
    pickupStopName: input.pickupStopName,
    destinationStopId: input.destinationStopId,
    destinationStopName: input.destinationStopName,
    desiredArrivalTime: arrivalTime,
    bufferMinutes: input.bufferMinutes,
    routeName: input.routeName,
  });
  return data as ProvisionalBookingResult;
}

export async function payBookingDeposit(
  bookingId: string,
  idempotencyKey: string,
): Promise<DepositVerificationResult> {
  const callbackUrl = Linking.createURL('booking-deposit');
  const { data: initialized } = await api.post(`/bookings/${bookingId}/deposit/initialize`, {
    idempotencyKey,
    callbackUrl,
  });
  const checkout = initialized as { reference: string; authorizationUrl?: string; alreadyPaid?: boolean };

  if (!checkout.alreadyPaid) {
    if (!checkout.authorizationUrl) throw new Error('Payment checkout is unavailable');
    await WebBrowser.openAuthSessionAsync(checkout.authorizationUrl, callbackUrl);
  }

  const { data } = await api.post(`/bookings/${bookingId}/deposit/verify`, {
    reference: checkout.reference,
  });
  return data as DepositVerificationResult;
}

export async function payBookingBalance(
  bookingId: string,
  idempotencyKey: string,
): Promise<DepositVerificationResult> {
  const callbackUrl = Linking.createURL('pay-driver');
  const { data: initialized } = await api.post(`/bookings/${bookingId}/balance/initialize`, {
    idempotencyKey,
    callbackUrl,
  });
  const checkout = initialized as { reference: string; authorizationUrl?: string; alreadyPaid?: boolean };
  if (!checkout.alreadyPaid) {
    if (!checkout.authorizationUrl) throw new Error('Balance checkout is unavailable');
    await WebBrowser.openAuthSessionAsync(checkout.authorizationUrl, callbackUrl);
  }
  const { data } = await api.post(`/bookings/${bookingId}/balance/verify`, {
    reference: checkout.reference,
  });
  return data as DepositVerificationResult;
}
