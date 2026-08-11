const toFiniteNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const getDepositPolicy = () => ({
  percentage: clamp(toFiniteNumber(process.env.BOOKING_DEPOSIT_PERCENT, 25), 0, 100),
  minimumGhs: Math.max(0, toFiniteNumber(process.env.BOOKING_DEPOSIT_MIN_GHS, 1)),
  holdMinutes: clamp(Math.trunc(toFiniteNumber(process.env.BOOKING_HOLD_MINUTES, 5)), 1, 30),
  cancellationMinutes: clamp(
    Math.trunc(toFiniteNumber(process.env.BOOKING_CANCELLATION_MINUTES, 30)), 0, 1440,
  ),
  noShowCompensationPercent: clamp(
    toFiniteNumber(process.env.NO_SHOW_DRIVER_COMPENSATION_PERCENT, 100), 0, 100,
  ),
});

const calculateDeposit = (fare, policy = getDepositPolicy()) => {
  const totalFare = roundMoney(Number(fare));
  if (!Number.isFinite(totalFare) || totalFare <= 0) {
    throw new TypeError('A positive route fare is required');
  }

  const percentageAmount = totalFare * (policy.percentage / 100);
  const depositAmount = roundMoney(Math.min(totalFare, Math.max(policy.minimumGhs, percentageAmount)));

  return {
    totalFare,
    depositAmount,
    remainingBalance: roundMoney(totalFare - depositAmount),
    percentage: policy.percentage,
    holdMinutes: policy.holdMinutes,
  };
};

const calculateBookingDeadlines = (desiredArrivalTime, bufferMinutes = 0, policy = getDepositPolicy()) => {
  const pickupAt = new Date(desiredArrivalTime);
  if (Number.isNaN(pickupAt.getTime())) throw new TypeError('A valid pickup time is required');
  return {
    cancellationDeadline: new Date(
      pickupAt.getTime() - policy.cancellationMinutes * 60 * 1000,
    ).toISOString(),
    boardingDeadline: new Date(
      pickupAt.getTime() + Math.max(0, Number(bufferMinutes) || 0) * 60 * 1000,
    ).toISOString(),
  };
};

module.exports = { calculateDeposit, calculateBookingDeadlines, getDepositPolicy, roundMoney };
