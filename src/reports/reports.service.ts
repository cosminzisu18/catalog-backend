import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ReportType } from '../common/enums/report-type.enum';
import { likePattern } from '../common/utils/pagination.util';

export type CursorPage<T> = { items: T[]; nextCursor: string | null };
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { ActivityReport } from './entities/activity-report.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ActivityReport)
    private readonly reportsRepo: Repository<ActivityReport>,
  ) {}

  // pass a manager when the report must be saved in the same transaction
  // as the action it describes (grade, request, decision)
  async create(
    input: {
      schoolId: number;
      teacherId?: number | null;
      type: ReportType;
      description: string;
      hoursDelta?: number;
      metadata?: Record<string, unknown>;
    },
    manager?: EntityManager,
  ): Promise<ActivityReport> {
    const repo = manager
      ? manager.getRepository(ActivityReport)
      : this.reportsRepo;
    return repo.save(
      repo.create({
        schoolId: input.schoolId,
        teacherId: input.teacherId ?? null,
        type: input.type,
        description: input.description,
        hoursDelta: input.hoursDelta ?? 0,
        metadata: input.metadata ?? null,
      }),
    );
  }

  // cursor paging: WHERE id < cursor ORDER BY id DESC LIMIT n.
  // Unlike OFFSET it stays fast on later pages, and new reports
  // don't cause duplicated or skipped rows.
  async list(
    filter: { schoolId?: number; teacherId?: number; teacherUserId?: number },
    query: ListReportsQueryDto = {},
  ): Promise<CursorPage<ActivityReport>> {
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const search = (query.search ?? '').trim();

    const qb = this.reportsRepo.createQueryBuilder('report');
    if (filter.schoolId) {
      qb.andWhere('report.schoolId = :schoolId', { schoolId: filter.schoolId });
    }
    if (filter.teacherId) {
      qb.andWhere('report.teacherId = :teacherId', {
        teacherId: filter.teacherId,
      });
    }
    if (filter.teacherUserId) {
      qb.innerJoin('report.teacher', 'teacher').andWhere(
        'teacher.userId = :userId',
        { userId: filter.teacherUserId },
      );
    }
    if (query.cursor) {
      qb.andWhere('report.id < :cursor', { cursor: Number(query.cursor) });
    }
    if (search) {
      qb.andWhere('report.description LIKE :q', { q: likePattern(search) });
    }

    // one extra row tells us if there is a next page, no COUNT(*) needed
    const rows = await qb
      .orderBy('report.id', 'DESC')
      .take(limit + 1)
      .getMany();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items,
      nextCursor: hasMore ? String(items[items.length - 1].id) : null,
    };
  }
}
