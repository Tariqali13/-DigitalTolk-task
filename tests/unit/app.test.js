jest.mock('morgan', () => jest.fn(() => (req, res, next) => next()));

describe('app setup', () => {
  afterEach(() => {
    process.env.NODE_ENV = 'test';
    jest.resetModules();
  });

  it('should enable request logging outside of tests', () => {
    process.env.NODE_ENV = 'development';
    const morgan = require('morgan');
    require('../../src/app');

    expect(morgan).toHaveBeenCalledWith('dev');
  });

  it('should not log requests in tests', () => {
    const morgan = require('morgan');
    require('../../src/app');

    expect(morgan).not.toHaveBeenCalled();
  });
});
