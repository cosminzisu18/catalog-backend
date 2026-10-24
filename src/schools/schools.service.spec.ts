jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  TypeOrmModule: {
    forFeature: jest.fn(),
    forRoot: jest.fn(),
    forRootAsync: jest.fn(),
  },
}));

jest.mock('../users/users.service', () => ({
  UsersService: class UsersService {},
}));

jest.mock('../directors/directors.service', () => ({
  DirectorsService: class DirectorsService {},
}));

import { ConflictException } from '@nestjs/common';
import { SchoolsService } from './schools.service';

describe('SchoolsService.registerSchool', () => {
  const dto = {
    schoolName: 'Liceul Test',
    slug: 'liceul-test',
    directorEmail: 'dir@test.ro',
    password: 'Parola1!Strong',
  };

  const schoolsRepo = { findOne: jest.fn() };
  const txSchoolsRepo = {
    create: jest.fn(<T>(x: T) => x),
    save: jest.fn(),
  };
  const manager = { getRepository: jest.fn(() => txSchoolsRepo) };
  const dataSource = {
    transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
      cb(manager),
    ),
  };
  const usersService = {
    findByEmail: jest.fn(),
    createUser: jest.fn(),
    attachSchool: jest.fn(),
  };
  const directorsService = {
    createProfile: jest.fn(),
  };

  const service = new SchoolsService(
    schoolsRepo as never,
    usersService as never,
    directorsService as never,
    dataSource as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    schoolsRepo.findOne.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(null);
    usersService.createUser.mockResolvedValue({ id: 5 });
    directorsService.createProfile.mockResolvedValue({ id: 1 });
  });

  it('creates director account as school login', async () => {
    txSchoolsRepo.save.mockResolvedValue({ id: 1, slug: 'liceul-test' });

    const result = await service.registerSchool(dto);

    expect(usersService.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'dir@test.ro' }),
      manager,
    );
    expect(txSchoolsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ directorUserId: 5 }),
    );
    expect(directorsService.createProfile).toHaveBeenCalledWith(
      { userId: 5, schoolId: 1 },
      manager,
    );
    expect(result.directorUserId).toBe(5);
  });

  it('rejects duplicate slug before opening a transaction', async () => {
    schoolsRepo.findOne.mockResolvedValue({ id: 9 });

    await expect(service.registerSchool(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
