import type { ScheduledBoardingResult, VerificationResult } from '@/types';

export const scheduledBoardingFailure = (error: unknown): VerificationResult & { shouldFallback: boolean } => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('boarding code not found')) return { success: false, source: 'SCHEDULED', error_code: 'CODE_NOT_FOUND', shouldFallback: true };
  if (message.includes('expired')) return { success: false, source: 'SCHEDULED', error_code: 'CODE_EXPIRED', shouldFallback: false };
  if (message.includes('used')) return { success: false, source: 'SCHEDULED', error_code: 'CODE_ALREADY_USED', shouldFallback: false };
  if (message.includes('another driver') || message.includes('assigned driver')) return { success: false, source: 'SCHEDULED', error_code: 'WRONG_DRIVER', shouldFallback: false };
  if (message.includes('boarding is not open') || message.includes('not active yet')) return { success: false, source: 'SCHEDULED', error_code: 'BOARDING_NOT_OPEN', shouldFallback: false };
  if (message.includes('cancel') || message.includes('invalidated')) return { success: false, source: 'SCHEDULED', error_code: 'CODE_INVALIDATED', shouldFallback: false };
  return { success: false, source: 'SCHEDULED', error_code: 'CODE_NOT_FOUND', shouldFallback: false };
};

export const verifyScheduledThenOrdinary = async (
  code: string,
  scheduledRedeem: (value: string) => Promise<ScheduledBoardingResult>,
  ordinaryRedeem: (value: string) => Promise<VerificationResult>,
): Promise<VerificationResult> => {
  try {
    const result = await scheduledRedeem(code);
    return {
      success: true,
      source: 'SCHEDULED',
      passenger_name: result.booking.passenger_name,
      confirmed_at: new Date().toISOString(),
    };
  } catch (error) {
    const failure = scheduledBoardingFailure(error);
    if (!failure.shouldFallback) {
      const { shouldFallback: _ignored, ...result } = failure;
      return result;
    }
    const ordinary = await ordinaryRedeem(code);
    return { ...ordinary, source: ordinary.success ? 'IMMEDIATE' : ordinary.source };
  }
};
