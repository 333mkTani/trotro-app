const occurrenceModel = require('../models/scheduleOccurrence.model');
const { ApiError } = require('../utils/ApiError');
const observability = require('../utils/observability');

const listRequests = (driverId) => occurrenceModel.listForDriver(driverId);
const listHistory = (driverId) => occurrenceModel.listHistoryForDriver(driverId);

const getRequest = async (occurrenceId, driverId) => {
  const occurrence = await occurrenceModel.findForDriver(occurrenceId, driverId);
  if (!occurrence) throw ApiError.notFound('Scheduled request not found');
  return occurrence;
};

const throwResponseError = (error) => {
  const messages = {
    NO_BUS: [400, 'Driver has no assigned bus'],
    NOT_FOUND: [404, 'Scheduled request not found'],
    ALREADY_ASSIGNED: [409, 'Another driver already accepted this request'],
    NOT_OPEN: [400, 'This request is no longer open'],
    DEADLINE_PASSED: [400, 'The driver acceptance deadline has passed'],
    WRONG_ROUTE: [403, 'This request is for a different route'],
    FULL: [409, 'No future seats remain for this boarding window'],
    NOT_ASSIGNED_DRIVER: [403, 'Only the assigned driver can withdraw'],
    BOARDING_OPEN: [400, 'Contact support because boarding has already opened'],
  };
  const [status, message] = messages[error] || [400, 'Could not update scheduled request'];
  throw new ApiError(status, message);
};

const accept = async (occurrenceId, driverId) => {
  const result = await occurrenceModel.acceptAtomic(occurrenceId, driverId);
  if (result.error) throwResponseError(result.error);
  observability.increment('schedule.accepted');
  observability.log('info', 'schedule.accepted', {
    occurrenceId, driverId, busId: result.bus?.id,
    alreadyAccepted: Boolean(result.alreadyAccepted),
  });
  return result;
};

const decline = async (occurrenceId, driverId, reason) => {
  const response = await occurrenceModel.decline(occurrenceId, driverId, reason);
  if (!response) throw ApiError.badRequest('This request is unavailable or belongs to another route');
  return response;
};

const withdraw = async (occurrenceId, driverId, reason) => {
  const result = await occurrenceModel.withdrawAtomic(occurrenceId, driverId, reason);
  if (result.error) throwResponseError(result.error);
  observability.increment('schedule.rematched');
  observability.log('info', 'schedule.driver.withdrawn', {
    occurrenceId, driverId, reason: reason || null,
  });
  return result;
};

module.exports = { listRequests, listHistory, getRequest, accept, decline, withdraw };
