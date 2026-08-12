const fs = require('fs');
const path = require('path');

describe('booking route authorization', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'booking.routes.js'), 'utf8');

  it('allows only passengers to call both booking creation endpoints', () => {
    expect(source).toContain("router.post('/', requireRole('passenger')");
    expect(source).toContain("router.post('/provisional', requireRole('passenger')");
  });
});
