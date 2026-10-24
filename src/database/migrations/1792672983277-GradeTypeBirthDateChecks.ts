import { MigrationInterface, QueryRunner } from 'typeorm';

export class GradeTypeBirthDateChecks1792672983277 implements MigrationInterface {
  name = 'GradeTypeBirthDateChecks1792672983277';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`grades\` ADD \`type\` enum ('NORMAL', 'THESIS') NOT NULL DEFAULT 'NORMAL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`students\` ADD \`birth_date\` date NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`grades\` ADD CONSTRAINT \`CHK_grades_value\` CHECK (\`value\` BETWEEN 1 AND 10)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`grade_edit_requests\` ADD CONSTRAINT \`CHK_grade_edit_requests_values\` CHECK (\`current_value\` BETWEEN 1 AND 10 AND \`proposed_value\` BETWEEN 1 AND 10)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`students\` ADD CONSTRAINT \`CHK_students_conduct_grade\` CHECK (\`conduct_grade\` BETWEEN 1 AND 10)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`conduct_requests\` ADD CONSTRAINT \`CHK_conduct_requests_proposed_grade\` CHECK (\`proposed_grade\` BETWEEN 1 AND 10)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`timetable_slots\` ADD CONSTRAINT \`CHK_timetable_slots_day\` CHECK (\`day_of_week\` BETWEEN 1 AND 7)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`timetable_slots\` ADD CONSTRAINT \`CHK_timetable_slots_times\` CHECK (\`start_time\` < \`end_time\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`timetable_slots\` DROP CONSTRAINT \`CHK_timetable_slots_times\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`timetable_slots\` DROP CONSTRAINT \`CHK_timetable_slots_day\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`conduct_requests\` DROP CONSTRAINT \`CHK_conduct_requests_proposed_grade\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`students\` DROP CONSTRAINT \`CHK_students_conduct_grade\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`grade_edit_requests\` DROP CONSTRAINT \`CHK_grade_edit_requests_values\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`grades\` DROP CONSTRAINT \`CHK_grades_value\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`students\` DROP COLUMN \`birth_date\``,
    );
    await queryRunner.query(`ALTER TABLE \`grades\` DROP COLUMN \`type\``);
  }
}
