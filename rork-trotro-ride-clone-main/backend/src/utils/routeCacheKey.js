const rounded = (value) => Number(value).toFixed(4);

const routeCacheKey = ({
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  profile,
  steps,
}) => [
  'routing',
  'directions',
  profile,
  steps ? 'steps' : 'no-steps',
  rounded(originLat),
  rounded(originLng),
  rounded(destinationLat),
  rounded(destinationLng),
].join(':');

module.exports = { routeCacheKey };
