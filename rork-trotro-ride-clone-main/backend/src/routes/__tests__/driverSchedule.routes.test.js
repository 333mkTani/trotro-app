const fs = require('fs');
const path = require('path');

describe('driver schedule route ordering', () => {
  const source = fs.readFileSync(path.join(__dirname, '../driverSchedule.routes.js'), 'utf8');

  it('registers static list routes before the occurrence detail parameter', () => {
    expect(source.indexOf("router.get('/requests'"))
      .toBeLessThan(source.indexOf("router.get('/:id'"));
    expect(source.indexOf("router.get('/history'"))
      .toBeLessThan(source.indexOf("router.get('/:id'"));
  });
});
