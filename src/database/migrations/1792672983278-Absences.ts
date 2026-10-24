import { MigrationInterface, QueryRunner } from 'typeorm';

const OLD_TYPES = `'GRADE_CREATE', 'GRADE_UPDATE', 'GRADE_EDIT_REQUEST', 'GRADE_EDIT_DECISION', 'HOURS_LOG', 'CONDUCT_REQUEST', 'CONDUCT_DECISION'`;
const NEW_TYPES = `${OLD_TYPES}, 'ABSENCE_CREATE', 'ABSENCE_MOTIVATE'`;

export class Absences1792672983278 implements MigrationInterface {
  name = 'Absences1792672983278';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`absences\` (\`id\` int NOT NULL AUTO_INCREMENT, \`school_id\` int NOT NULL, \`student_id\` int NOT NULL, \`subject_id\` int NOT NULL, \`teacher_id\` int NOT NULL, \`absent_on\` date NOT NULL, \`motivated\` tinyint NOT NULL DEFAULT 0, \`motivated_reason\` varchar(255) NULL, \`motivated_at\` datetime NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_absences_school\` (\`school_id\`), INDEX \`IDX_absences_student\` (\`student_id\`), INDEX \`IDX_absences_teacher\` (\`teacher_id\`), UNIQUE INDEX \`IDX_absences_one_per_day\` (\`student_id\`, \`subject_id\`, \`absent_on\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    for (const [column, table] of [
      ['school_id', 'schools'],
      ['student_id', 'students'],
      ['subject_id', 'subjects'],
      ['teacher_id', 'teachers'],
    ]) {
      await queryRunner.query(
        `ALTER TABLE \`absences\` ADD CONSTRAINT \`FK_absences_${column}\` FOREIGN KEY (\`${column}\`) REFERENCES \`${table}\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE \`activity_reports\` MODIFY \`type\` enum (${NEW_TYPES}) NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`activity_reports\` WHERE \`type\` IN ('ABSENCE_CREATE', 'ABSENCE_MOTIVATE')`,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_reports\` MODIFY \`type\` enum (${OLD_TYPES}) NOT NULL`,
    );
    await queryRunner.query(`DROP TABLE \`absences\``);
  }
}
