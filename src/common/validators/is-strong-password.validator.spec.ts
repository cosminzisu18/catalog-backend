import { IsStrongPasswordConstraint } from './is-strong-password.validator';

describe('IsStrongPasswordConstraint', () => {
  const validator = new IsStrongPasswordConstraint();

  it('accepts a strong password', () => {
    expect(validator.validate('Parola1!Strong')).toBe(true);
  });

  it('rejects short or weak passwords', () => {
    expect(validator.validate('abc')).toBe(false);
    expect(validator.validate('parolalunga')).toBe(false);
    expect(validator.validate('Parolalunga1')).toBe(false);
    expect(validator.validate(null)).toBe(false);
  });
});
