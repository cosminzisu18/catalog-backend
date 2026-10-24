import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { School } from '../schools/entities/school.entity';
import { UsersService } from '../users/users.service';
import { CreateDirectorDto } from './dto/create-director.dto';
import { UpdateDirectorDto } from './dto/update-director.dto';
import { Director } from './entities/director.entity';

export type DirectorView = Director & {
  email: string;
  isActive: boolean;
  isCurrent: boolean;
};

@Injectable()
export class DirectorsService {
  constructor(
    @InjectRepository(Director)
    private readonly directorsRepo: Repository<Director>,
    @InjectRepository(School)
    private readonly schoolsRepo: Repository<School>,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  async createProfile(
    input: {
      userId: number;
      schoolId: number;
      firstName?: string;
      lastName?: string;
    },
    manager?: EntityManager,
  ): Promise<Director> {
    const repo = manager ? manager.getRepository(Director) : this.directorsRepo;
    return repo.save(
      repo.create({
        userId: input.userId,
        schoolId: input.schoolId,
        firstName: input.firstName?.trim() || '',
        lastName: input.lastName?.trim() || '',
      }),
    );
  }

  async getByUserIdOrFail(userId: number): Promise<Director> {
    const director = await this.directorsRepo.findOne({ where: { userId } });
    if (!director) {
      throw new NotFoundException('Profilul de director nu a fost gasit');
    }
    return director;
  }

  async findByUserId(userId: number): Promise<Director | null> {
    return this.directorsRepo.findOne({ where: { userId } });
  }

  private async toView(
    director: Director,
    activeDirectorUserId: number | null,
  ): Promise<DirectorView> {
    const user = await this.usersService.getByIdOrFail(director.userId);
    return {
      ...director,
      email: user.email,
      isActive: user.isActive,
      isCurrent:
        activeDirectorUserId != null &&
        director.userId === activeDirectorUserId,
    };
  }

  async listForSchool(schoolId: number): Promise<DirectorView[]> {
    const school = await this.schoolsRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Scoala nu a fost gasita');

    const rows = await this.directorsRepo.find({
      where: { schoolId },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });

    return Promise.all(rows.map((d) => this.toView(d, school.directorUserId)));
  }

  async createForSchool(
    schoolId: number,
    dto: CreateDirectorDto,
  ): Promise<DirectorView> {
    await this.usersService.assertEmailAvailable(dto.email);

    const { directorId, activate } = await this.dataSource.transaction(
      async (manager) => {
        const schoolsRepo = manager.getRepository(School);
        const school = await schoolsRepo.findOneOrFail({
          where: { id: schoolId },
        });

        const user = await this.usersService.createUser(
          {
            email: dto.email,
            password: dto.temporaryPassword,
            role: Role.DIRECTOR,
            schoolId,
            mustChangePassword: true,
          },
          manager,
        );
        const director = await this.createProfile(
          {
            userId: user.id,
            schoolId,
            firstName: dto.firstName,
            lastName: dto.lastName,
          },
          manager,
        );

        // the first director (or any, if none is active) becomes active
        const shouldActivate = school.directorUserId == null;
        if (shouldActivate) {
          await schoolsRepo.update(
            { id: schoolId },
            { directorUserId: user.id },
          );
        }

        return { directorId: director.id, activate: shouldActivate };
      },
    );

    const director = await this.directorsRepo.findOneOrFail({
      where: { id: directorId },
    });
    const school = await this.schoolsRepo.findOneOrFail({
      where: { id: schoolId },
    });
    return this.toView(
      director,
      activate ? director.userId : school.directorUserId,
    );
  }

  async updateMe(userId: number, dto: UpdateDirectorDto): Promise<Director> {
    const director = await this.getByUserIdOrFail(userId);
    if (dto.firstName !== undefined) director.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) director.lastName = dto.lastName.trim();
    if (!director.firstName || !director.lastName) {
      throw new BadRequestException('Prenumele si numele sunt obligatorii');
    }
    return this.directorsRepo.save(director);
  }

  // one active director per school: the new one replaces the old one
  // (the old one stays in the list, just not active anymore)
  async activate(schoolId: number, directorId: number): Promise<DirectorView> {
    const director = await this.directorsRepo.findOne({
      where: { id: directorId, schoolId },
    });
    if (!director) {
      throw new NotFoundException('Directorul nu a fost gasit');
    }

    const user = await this.usersService.getByIdOrFail(director.userId);
    if (!user.isActive) {
      throw new BadRequestException('Contul directorului este inactiv');
    }
    if (!director.firstName.trim() || !director.lastName.trim()) {
      throw new BadRequestException(
        'Directorul trebuie sa aiba prenume si nume inainte de activare',
      );
    }

    await this.schoolsRepo.update(
      { id: schoolId },
      { directorUserId: director.userId },
    );

    return this.toView(director, director.userId);
  }

  async setActive(
    schoolId: number,
    directorId: number,
    isActive: boolean,
  ): Promise<DirectorView> {
    const director = await this.directorsRepo.findOne({
      where: { id: directorId, schoolId },
    });
    if (!director) {
      throw new NotFoundException('Directorul nu a fost gasit');
    }

    const school = await this.schoolsRepo.findOneOrFail({
      where: { id: schoolId },
    });
    if (!isActive && school.directorUserId === director.userId) {
      throw new ConflictException(
        'Nu poti dezactiva contul directorului activ. Activeaza mai intai pe altcineva.',
      );
    }

    await this.usersService.setActive(director.userId, isActive);
    return this.toView(director, school.directorUserId);
  }
}
