import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IsPersonName, PERSON_NAME_REGEX } from './is-person-name.validator';

class Person {
  @IsPersonName()
  name: string;
}

function check(name: unknown) {
  const person = plainToInstance(Person, { name });
  return { person, errors: validateSync(person) };
}

describe('IsPersonName', () => {
  it.each([
    'Ana',
    'Ana-Maria',
    'Popescu Ionescu',
    'Ștefănescu',
    'Țîrlea',
    "O'Neil",
  ])('accepts %s', (name) => {
    expect(PERSON_NAME_REGEX.test(name)).toBe(true);
    expect(check(name).errors).toHaveLength(0);
  });

  it.each([
    'A',
    'Ion3',
    'Ana_Maria',
    '--',
    'Ana  -Maria',
    '<script>',
    'x'.repeat(81),
  ])('rejects %s', (name) => {
    expect(check(name).errors).not.toHaveLength(0);
  });

  it('rejects values that are not text', () => {
    expect(check(42).errors).not.toHaveLength(0);
    expect(check(null).errors).not.toHaveLength(0);
  });

  it('trims and collapses extra spaces', () => {
    const { person, errors } = check('  Ana   Maria ');
    expect(errors).toHaveLength(0);
    expect(person.name).toBe('Ana Maria');
  });
});
