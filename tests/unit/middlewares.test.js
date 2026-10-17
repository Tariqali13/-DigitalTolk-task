const Joi = require('joi');
const validate = require('../../src/middlewares/validate.middleware');
const { errorHandler } = require('../../src/middlewares/error.middleware');
const ApiError = require('../../src/utils/ApiError');

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('validate middleware', () => {
  const schema = Joi.object({ name: Joi.string().required(), age: Joi.number().default(18) });

  it('should replace the body with the validated value', () => {
    const req = { body: { name: 'Ali', extra: 'removed' } };
    const next = jest.fn();

    validate(schema)(req, {}, next);

    expect(req.body).toEqual({ name: 'Ali', age: 18 });
    expect(next).toHaveBeenCalled();
  });

  it('should put validated query in req.validatedQuery', () => {
    const req = { query: { name: 'Ali', age: '20' } };

    validate(schema, 'query')(req, {}, jest.fn());

    expect(req.validatedQuery).toEqual({ name: 'Ali', age: 20 });
  });

  it('should throw 422 with field errors', () => {
    expect.assertions(2);
    try {
      validate(schema)({ body: { age: 'abc' } }, {}, jest.fn());
    } catch (err) {
      expect(err.statusCode).toBe(422);
      expect(err.errors.map((e) => e.field)).toEqual(['name', 'age']);
    }
  });
});

describe('error middleware', () => {
  it('should return the ApiError status and message', () => {
    const res = mockResponse();
    errorHandler(new ApiError(404, 'Not found'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Not found' });
  });

  it('should return 409 for unique constraint errors from postgres', () => {
    const res = mockResponse();
    errorHandler({ code: '23505' }, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('should return 500 for unknown errors and log them', () => {
    const res = mockResponse();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(new Error('db is down'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Something went wrong, please try again later' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
