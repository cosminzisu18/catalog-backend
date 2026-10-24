import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { EntityManager, Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { User } from './entities/user.entity';

const BCRYPT_ROUNDS = 12;

// dummy hash used when the email does not exist, so login takes the same
// time and nobody can tell which accounts exist from the response time
const TIMING_GUARD_HASH =
  '$2b$12$NQBOYilFE/s2UmpIEjkmSejKFv2RuDZFIY1aHvRMlrUZRO6Ur5z.2';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  // pass a manager when the call is part of a transaction
  private repo(manager?: EntityManager): Repository<User> {
    return manager ? manager.getRepository(User) : this.usersRepo;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email: email.toLowerCase() } });
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async getByIdOrFail(id: number): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Utilizatorul nu a fost gasit');
    }
    return user;
  }

  async assertEmailAvailable(email: string, exceptUserId?: number) {
    const existing = await this.findByEmail(email);
    if (existing && existing.id !== exceptUserId) {
      throw new ConflictException('Emailul este deja folosit');
    }
  }

  async createUser(
    input: {
      email: string;
      password: string;
      role: Role;
      schoolId: number | null;
      mustChangePassword?: boolean;
    },
    manager?: EntityManager,
  ): Promise<User> {
    const repo = this.repo(manager);
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    return repo.save(
      repo.create({
        email: input.email.toLowerCase(),
        passwordHash,
        role: input.role,
        schoolId: input.schoolId,
        mustChangePassword: input.mustChangePassword ?? false,
      }),
    );
  }

  async verifyCredentials(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.findByEmail(email);
    const ok = await bcrypt.compare(
      password,
      user?.passwordHash ?? TIMING_GUARD_HASH,
    );
    return user && ok ? user : null;
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async updatePassword(
    userId: number,
    password: string,
    mustChangePassword = false,
    manager?: EntityManager,
  ): Promise<void> {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    // tokenVersion++ ends all sessions opened with the old password
    await this.repo(manager).update(userId, {
      passwordHash,
      mustChangePassword,
      tokenVersion: () => 'token_version + 1',
    });
  }

  async updateEmail(
    userId: number,
    email: string,
    manager?: EntityManager,
  ): Promise<void> {
    const normalized = email.toLowerCase();
    await this.assertEmailAvailable(normalized, userId);
    await this.repo(manager).update(userId, { email: normalized });
  }

  async attachSchool(
    userId: number,
    schoolId: number,
    manager?: EntityManager,
  ): Promise<void> {
    await this.repo(manager).update(userId, { schoolId });
  }

  async setActive(userId: number, isActive: boolean): Promise<void> {
    // a disabled account is logged out right away on every device
    await this.usersRepo.update(
      userId,
      isActive
        ? { isActive }
        : { isActive, tokenVersion: () => 'token_version + 1' },
    );
  }

  // the teacher/student profile and everything under it go by FK cascade
  async deleteById(userId: number): Promise<void> {
    await this.usersRepo.delete({ id: userId });
  }
}
