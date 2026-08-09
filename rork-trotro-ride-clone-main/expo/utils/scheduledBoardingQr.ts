import type { ScheduleOccurrence } from '@/types';

type ScheduledBoardingQrFields = Pick<
  ScheduleOccurrence,
  'status' | 'boarding_code' | 'boarding_qr_payload' | 'code_status'
>;

export const getScheduledBoardingQrValue = (
  occurrence: ScheduledBoardingQrFields,
): string | null => {
  if (
    occurrence.status !== 'boarding_open' ||
    occurrence.code_status !== 'active' ||
    !occurrence.boarding_code?.trim()
  ) {
    return null;
  }

  return occurrence.boarding_qr_payload?.trim() || occurrence.boarding_code.trim();
};
