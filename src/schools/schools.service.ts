import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { DirectorsService } from '../directors/directors.service';
import { UsersService } from '../users/users.service';
import { RegisterSchoolDto } from './dto/register-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { School } from './entities/school.entity';

@Injectable()
export class SchoolsService {
  constructor(
    @InjectRepository(School)
    private readonly schoolsRepo: Repository<School>,
    private readonly usersService: UsersService,
    private readonly directorsService: DirectorsService,
    private readonly dataSource: DataSource,
  ) {}

  async registerSchool(dto: RegisterSchoolDto): Promise<{
    school: School;
    directorUserId: number;
  }> {
    const slug = dto.slug.toLowerCase();
    const existingSlug = await this.schoolsRepo.findOne({ where: { slug } });
    if (existingSlug) {
      throw new ConflictException('Exista deja o scoala cu acest slug');
    }

    const existingEmail = await this.usersService.findByEmail(
      dto.directorEmail,
    );
    if (existingEmail) {
      throw new ConflictException('Emailul este deja folosit');
    }

    // the login account belongs to the director; the name is filled in later
    return this.dataSource.transaction(async (manager) => {
      const director = await this.usersService.createUser(
        {
          email: dto.directorEmail,
          password: dto.password,
          role: Role.DIRECTOR,
          schoolId: null,
          mustChangePassword: false,
        },
        manager,
      );

      const schoolsRepo = manager.getRepository(School);
      const school = await schoolsRepo.save(
        schoolsRepo.create({
          name: dto.schoolName,
          slug,
          address: dto.address ?? null,
          phone: dto.phone ?? null,
          directorUserId: director.id,
        }),
      );

      await this.usersService.attachSchool(director.id, school.id, manager);
      await this.directorsService.createProfile(
        { userId: director.id, schoolId: school.id },
        manager,
      );

      return { school, directorUserId: director.id };
    });
  }

  async findBySlug(slug: string): Promise<School | null> {
    return this.schoolsRepo.findOne({ where: { slug: slug.toLowerCase() } });
  }

  async getByIdOrFail(id: number): Promise<School> {
    const school = await this.schoolsRepo.findOne({ where: { id } });
    if (!school) {
      throw new NotFoundException('Scoala nu a fost gasita');
    }
    return school;
  }

  async updateSchool(schoolId: number, dto: UpdateSchoolDto): Promise<School> {
    const school = await this.getByIdOrFail(schoolId);
    Object.assign(school, dto);
    return this.schoolsRepo.save(school);
  }

  async getPublicBySlug(
    slug: string,
  ): Promise<Pick<School, 'id' | 'name' | 'slug'>> {
    const school = await this.findBySlug(slug);
    if (!school) {
      throw new NotFoundException('Scoala nu a fost gasita');
    }
    return { id: school.id, name: school.name, slug: school.slug };
  }
}
