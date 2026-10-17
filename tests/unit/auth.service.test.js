jest.mock('../../src/repositories/user.repository');

const bcrypt = require('bcryptjs');
const authService = require('../../src/services/auth.service');
const userRepository = require('../../src/repositories/user.repository');

describe('AuthService.login', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should still check the password when the email does not exist', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    const compare = jest.spyOn(bcrypt, 'compare');

    await expect(
      authService.login({ email: 'nobody@test.com', password: 'password123' }),
    ).rejects.toMatchObject({ statusCode: 401 });

    // compared against the dummy hash, so the response time is the same as for a real user
    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0][1]).toMatch(/^\$2[ab]\$10\$/);
  });

  it('should take about the same time for unknown and known emails', async () => {
    const hash = await bcrypt.hash('password123', 10);

    userRepository.findByEmail.mockResolvedValue({ id: 1, email: 'ali@test.com', password: hash });
    let start = Date.now();
    await authService.login({ email: 'ali@test.com', password: 'wrong-password' }).catch(() => {});
    const knownEmailTime = Date.now() - start;

    userRepository.findByEmail.mockResolvedValue(null);
    start = Date.now();
    await authService.login({ email: 'nobody@test.com', password: 'wrong-password' }).catch(() => {});
    const unknownEmailTime = Date.now() - start;

    // without the dummy hash unknown emails returned in ~0ms vs ~50ms+ for known ones
    expect(unknownEmailTime).toBeGreaterThan(knownEmailTime / 2);
  });
});
