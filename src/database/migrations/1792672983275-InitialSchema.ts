import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1792672983275 implements MigrationInterface {
  name = 'InitialSchema1792672983275';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`schools\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(180) NOT NULL, \`slug\` varchar(120) NOT NULL, \`address\` varchar(255) NULL, \`phone\` varchar(40) NULL, \`director_user_id\` int NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_150b12170135ff067a24ea270d\` (\`slug\`), INDEX \`IDX_3713afaf59c1448ba5f844b012\` (\`director_user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`users\` (\`id\` int NOT NULL AUTO_INCREMENT, \`email\` varchar(180) NOT NULL, \`password_hash\` varchar(255) NOT NULL, \`role\` enum ('DIRECTOR', 'TEACHER', 'STUDENT') NOT NULL, \`school_id\` int NULL, \`must_change_password\` tinyint NOT NULL DEFAULT 0, \`is_active\` tinyint NOT NULL DEFAULT 1, \`token_version\` int NOT NULL DEFAULT '0', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`), INDEX \`IDX_25e1cf8f41bae2f3d11f3c2a02\` (\`school_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`directors\` (\`id\` int NOT NULL AUTO_INCREMENT, \`user_id\` int NOT NULL, \`school_id\` int NOT NULL, \`first_name\` varchar(80) NOT NULL DEFAULT '', \`last_name\` varchar(80) NOT NULL DEFAULT '', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_directors_school_id\` (\`school_id\`), UNIQUE INDEX \`REL_directors_user_id\` (\`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`teachers\` (\`id\` int NOT NULL AUTO_INCREMENT, \`user_id\` int NOT NULL, \`school_id\` int NOT NULL, \`first_name\` varchar(80) NOT NULL, \`last_name\` varchar(80) NOT NULL, \`hours_taught\` decimal(8,2) NOT NULL DEFAULT '0.00', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_5656d1b6d40765ea6b135b35d4\` (\`school_id\`), UNIQUE INDEX \`REL_4668d4752e6766682d1be0b346\` (\`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`subjects\` (\`id\` int NOT NULL AUTO_INCREMENT, \`school_id\` int NOT NULL, \`name\` varchar(120) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_07a82eb883094a6990b914cc15\` (\`school_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`teacher_subjects\` (\`id\` int NOT NULL AUTO_INCREMENT, \`school_id\` int NOT NULL, \`teacher_id\` int NOT NULL, \`subject_id\` int NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_teacher_subjects_school\` (\`school_id\`), UNIQUE INDEX \`IDX_teacher_subjects_unique\` (\`teacher_id\`, \`subject_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`class_teachers\` (\`id\` int NOT NULL AUTO_INCREMENT, \`school_id\` int NOT NULL, \`class_id\` int NOT NULL, \`teacher_id\` int NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_class_teachers_school\` (\`school_id\`), UNIQUE INDEX \`IDX_class_teachers_unique\` (\`class_id\`, \`teacher_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`school_classes\` (\`id\` int NOT NULL AUTO_INCREMENT, \`school_id\` int NOT NULL, \`name\` varchar(40) NOT NULL, \`description\` varchar(200) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_8e1e4aefbf8e2fc2f2ae449a74\` (\`school_id\`), UNIQUE INDEX \`IDX_3fdf1942e351a8c1702c3b7dd5\` (\`school_id\`, \`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`timetable_slots\` (\`id\` int NOT NULL AUTO_INCREMENT, \`school_id\` int NOT NULL, \`class_id\` int NOT NULL, \`day_of_week\` tinyint NOT NULL, \`start_time\` varchar(5) NOT NULL, \`end_time\` varchar(5) NOT NULL, \`subject_id\` int NOT NULL, \`teacher_id\` int NOT NULL, \`room\` varchar(40) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_173fac1c846b3efb3fdb4dbdaa\` (\`school_id\`), INDEX \`IDX_da4356c886fae446a536a69f1b\` (\`subject_id\`), INDEX \`IDX_413d6d03d85327b1023dc8548a\` (\`teacher_id\`, \`day_of_week\`), UNIQUE INDEX \`IDX_e29ecb29e836d3ac17735de80d\` (\`class_id\`, \`day_of_week\`, \`start_time\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`students\` (\`id\` int NOT NULL AUTO_INCREMENT, \`user_id\` int NOT NULL, \`school_id\` int NOT NULL, \`first_name\` varchar(80) NOT NULL, \`last_name\` varchar(80) NOT NULL, \`class_id\` int NOT NULL, \`conduct_grade\` decimal(4,2) NOT NULL DEFAULT '10.00', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_aa8edc7905ad764f8592456964\` (\`school_id\`), INDEX \`IDX_de6ad4ae6936dce474e2823984\` (\`class_id\`), UNIQUE INDEX \`REL_fb3eff90b11bddf7285f9b4e28\` (\`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`activity_reports\` (\`id\` int NOT NULL AUTO_INCREMENT, \`school_id\` int NOT NULL, \`teacher_id\` int NULL, \`type\` enum ('GRADE_CREATE', 'GRADE_UPDATE', 'GRADE_EDIT_REQUEST', 'GRADE_EDIT_DECISION', 'HOURS_LOG', 'CONDUCT_REQUEST', 'CONDUCT_DECISION') NOT NULL, \`description\` text NOT NULL, \`hours_delta\` decimal(8,2) NOT NULL DEFAULT '0.00', \`metadata\` json NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_4a1b5439913a301b965165bb92\` (\`school_id\`), INDEX \`IDX_76a9d66500d533560f5975a47f\` (\`teacher_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`grades\` (\`id\` int NOT NULL AUTO_INCREMENT, \`student_id\` int NOT NULL, \`subject_id\` int NOT NULL, \`teacher_id\` int NOT NULL, \`school_id\` int NOT NULL, \`value\` decimal(4,2) NOT NULL, \`graded_on\` date NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_9acca493883cee3b9e8f9e01cd\` (\`student_id\`), INDEX \`IDX_ae1618ce22f07ef3e5e51d4c9e\` (\`subject_id\`), INDEX \`IDX_4e40960913bb4a4c059fa9939d\` (\`teacher_id\`), INDEX \`IDX_011e8eccc5fb5685680244bf19\` (\`school_id\`), UNIQUE INDEX \`IDX_91381ab2c238848ce3490b2a64\` (\`student_id\`, \`subject_id\`, \`graded_on\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`grade_edit_requests\` (\`id\` int NOT NULL AUTO_INCREMENT, \`school_id\` int NOT NULL, \`grade_id\` int NOT NULL, \`student_id\` int NOT NULL, \`subject_id\` int NOT NULL, \`teacher_id\` int NOT NULL, \`current_value\` decimal(4,2) NOT NULL, \`proposed_value\` decimal(4,2) NOT NULL, \`teacher_reason\` text NOT NULL, \`director_reason\` text NULL, \`status\` enum ('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_801fac5292845740775b34d971\` (\`grade_id\`), INDEX \`IDX_b8c8432ca4b874cb25b73716f0\` (\`student_id\`), INDEX \`IDX_2d32eebf7bc289d3f498d97bb7\` (\`subject_id\`), INDEX \`IDX_a4457f6efdc8637d35b3fa5360\` (\`teacher_id\`), INDEX \`IDX_356a7f5959de05d4dbd8ae0af0\` (\`school_id\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`conduct_requests\` (\`id\` int NOT NULL AUTO_INCREMENT, \`school_id\` int NOT NULL, \`student_id\` int NOT NULL, \`teacher_id\` int NOT NULL, \`proposed_grade\` decimal(4,2) NOT NULL, \`teacher_reason\` text NOT NULL, \`director_reason\` text NULL, \`status\` enum ('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_7951f5a1315890925d49af4b9e\` (\`student_id\`), INDEX \`IDX_7ac08d7704e1e0b8eb15869bc2\` (\`teacher_id\`), INDEX \`IDX_81870af3aa824bf57f352de7c8\` (\`school_id\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`refresh_tokens\` (\`id\` int NOT NULL AUTO_INCREMENT, \`user_id\` int NOT NULL, \`family_id\` char(36) NOT NULL, \`token_hash\` char(64) NOT NULL, \`token_version\` int NOT NULL, \`remember_me\` tinyint NOT NULL DEFAULT 0, \`expires_at\` datetime NOT NULL, \`used_at\` datetime NULL, \`revoked_at\` datetime NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_3ddc983c5f7bcf132fd8732c3f\` (\`user_id\`), INDEX \`IDX_d5e27da0cd39bc3bb2811fc8ba\` (\`family_id\`), UNIQUE INDEX \`IDX_a7838d2ba25be1342091b6695f\` (\`token_hash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`schools\` ADD CONSTRAINT \`FK_3713afaf59c1448ba5f844b0129\` FOREIGN KEY (\`director_user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD CONSTRAINT \`FK_25e1cf8f41bae2f3d11f3c2a028\` FOREIGN KEY (\`school_id\`) REFERENCES \`schools\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`directors\` ADD CONSTRAINT \`FK_directors_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`directors\` ADD CONSTRAINT \`FK_directors_school_id\` FOREIGN KEY (\`school_id\`) REFERENCES \`schools\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`teachers\` ADD CONSTRAINT \`FK_4668d4752e6766682d1be0b346f\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`teachers\` ADD CONSTRAINT \`FK_5656d1b6d40765ea6b135b35d4b\` FOREIGN KEY (\`school_id\`) REFERENCES \`schools\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`subjects\` ADD CONSTRAINT \`FK_07a82eb883094a6990b914cc15e\` FOREIGN KEY (\`school_id\`) REFERENCES \`schools\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`teacher_subjects\` ADD CONSTRAINT \`FK_teacher_subjects_school\` FOREIGN KEY (\`school_id\`) REFERENCES \`schools\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`teacher_subjects\` ADD CONSTRAINT \`FK_teacher_subjects_teacher\` FOREIGN KEY (\`teacher_id\`) REFERENCES \`teachers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`teacher_subjects\` ADD CONSTRAINT \`FK_teacher_subjects_subject\` FOREIGN KEY (\`subject_id\`) REFERENCES \`subjects\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`class_teachers\` ADD CONSTRAINT \`FK_class_teachers_school\` FOREIGN KEY (\`school_id\`) REFERENCES \`schools\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`class_teachers\` ADD CONSTRAINT \`FK_class_teachers_class\` FOREIGN KEY (\`class_id\`) REFERENCES \`school_classes\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`class_teachers\` ADD CONSTRAINT \`FK_class_teachers_teacher\` FOREIGN KEY (\`teacher_id\`) REFERENCES \`teachers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`school_classes\` ADD CONSTRAINT \`FK_8e1e4aefbf8e2fc2f2ae449a74c\` FOREIGN KEY (\`school_id\`) REFERENCES \`schools\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`timetable_slots\` ADD CONSTRAINT \`FK_173fac1c846b3efb3fdb4dbdaa8\` FOREIGN KEY (\`school_id\`) REFERENCES \`schools\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`timetable_slots\` ADD CONSTRAINT \`FK_c7b9db0505fd3ed9ad612f073e8\` FOREIGN KEY (\`class_id\`) REFERENCES \`school_classes\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`timetable_slots\` ADD CONSTRAINT \`FK_da4356c886fae446a536a69f1b5\` FOREIGN KEY (\`subject_id\`) REFERENCES \`subjects\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`timetable_slots\` ADD CONSTRAINT \`FK_b55795af4ec086b54c854193c6b\` FOREIGN KEY (\`teacher_id\`) REFERENCES \`teachers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`students\` ADD CONSTRAINT \`FK_fb3eff90b11bddf7285f9b4e281\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`students\` ADD CONSTRAINT \`FK_aa8edc7905ad764f85924569647\` FOREIGN KEY (\`school_id\`) REFERENCES \`schools\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`students\` ADD CONSTRAINT \`FK_de6ad4ae6936dce474e2823984e\` FOREIGN KEY (\`class_id\`) REFERENCES \`school_classes\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_reports\` ADD CONSTRAINT \`FK_4a1b5439913a301b965165bb92d\` FOREIGN KEY (\`school_id\`) REFERENCES \`schools\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_reports\` ADD CONSTRAINT \`FK_76a9d66500d533560f5975a47fe\` FOREIGN KEY (\`teacher_id\`) REFERENCES \`teachers\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`grades\` ADD CONSTRAINT \`FK_9acca493883cee3b9e8f9e01cd1\` FOREIGN KEY (\`student_id\`) REFERENCES \`students\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`grades\` ADD CONSTRAINT \`FK_ae1618ce22f07ef3e5e51d4c9e8\` FOREIGN KEY (\`subject_id\`) REFERENCES \`subjects\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`grades\` ADD CONSTRAINT \`FK_4e40960913bb4a4c059fa9939d6\` FOREIGN KEY (\`teacher_id\`) REFERENCES \`teachers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`grades\` ADD CONSTRAINT \`FK_011e8eccc5fb5685680244bf19c\` FOREIGN KEY (\`school_id\`) REFERENCES \`schools\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`grade_edit_requests\` ADD CONSTRAINT \`FK_72eb7da1cf1e5e702a67ec03e26\` FOREIGN KEY (\`school_id\`) REFERENCES \`schools\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`grade_edit_requests\` ADD CONSTRAINT \`FK_801fac5292845740775b34d9714\` FOREIGN KEY (\`grade_id\`) REFERENCES \`grades\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`grade_edit_requests\` ADD CONSTRAINT \`FK_b8c8432ca4b874cb25b73716f0c\` FOREIGN KEY (\`student_id\`) REFERENCES \`students\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`grade_edit_requests\` ADD CONSTRAINT \`FK_2d32eebf7bc289d3f498d97bb7d\` FOREIGN KEY (\`subject_id\`) REFERENCES \`subjects\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`grade_edit_requests\` ADD CONSTRAINT \`FK_a4457f6efdc8637d35b3fa53601\` FOREIGN KEY (\`teacher_id\`) REFERENCES \`teachers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`conduct_requests\` ADD CONSTRAINT \`FK_afa2354c764f7edff887c4fa898\` FOREIGN KEY (\`school_id\`) REFERENCES \`schools\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`conduct_requests\` ADD CONSTRAINT \`FK_7951f5a1315890925d49af4b9e1\` FOREIGN KEY (\`student_id\`) REFERENCES \`students\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`conduct_requests\` ADD CONSTRAINT \`FK_7ac08d7704e1e0b8eb15869bc26\` FOREIGN KEY (\`teacher_id\`) REFERENCES \`teachers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` ADD CONSTRAINT \`FK_3ddc983c5f7bcf132fd8732c3f4\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` DROP FOREIGN KEY \`FK_3ddc983c5f7bcf132fd8732c3f4\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`conduct_requests\` DROP FOREIGN KEY \`FK_7ac08d7704e1e0b8eb15869bc26\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`conduct_requests\` DROP FOREIGN KEY \`FK_7951f5a1315890925d49af4b9e1\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`conduct_requests\` DROP FOREIGN KEY \`FK_afa2354c764f7edff887c4fa898\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`grade_edit_requests\` DROP FOREIGN KEY \`FK_a4457f6efdc8637d35b3fa53601\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`grade_edit_requests\` DROP FOREIGN KEY \`FK_2d32eebf7bc289d3f498d97bb7d\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`grade_edit_requests\` DROP FOREIGN KEY \`FK_b8c8432ca4b874cb25b73716f0c\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`grade_edit_requests\` DROP FOREIGN KEY \`FK_801fac5292845740775b34d9714\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`grade_edit_requests\` DROP FOREIGN KEY \`FK_72eb7da1cf1e5e702a67ec03e26\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`grades\` DROP FOREIGN KEY \`FK_011e8eccc5fb5685680244bf19c\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`grades\` DROP FOREIGN KEY \`FK_4e40960913bb4a4c059fa9939d6\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`grades\` DROP FOREIGN KEY \`FK_ae1618ce22f07ef3e5e51d4c9e8\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`grades\` DROP FOREIGN KEY \`FK_9acca493883cee3b9e8f9e01cd1\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_reports\` DROP FOREIGN KEY \`FK_76a9d66500d533560f5975a47fe\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_reports\` DROP FOREIGN KEY \`FK_4a1b5439913a301b965165bb92d\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`students\` DROP FOREIGN KEY \`FK_de6ad4ae6936dce474e2823984e\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`students\` DROP FOREIGN KEY \`FK_aa8edc7905ad764f85924569647\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`students\` DROP FOREIGN KEY \`FK_fb3eff90b11bddf7285f9b4e281\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`timetable_slots\` DROP FOREIGN KEY \`FK_b55795af4ec086b54c854193c6b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`timetable_slots\` DROP FOREIGN KEY \`FK_da4356c886fae446a536a69f1b5\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`timetable_slots\` DROP FOREIGN KEY \`FK_c7b9db0505fd3ed9ad612f073e8\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`timetable_slots\` DROP FOREIGN KEY \`FK_173fac1c846b3efb3fdb4dbdaa8\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`school_classes\` DROP FOREIGN KEY \`FK_8e1e4aefbf8e2fc2f2ae449a74c\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`class_teachers\` DROP FOREIGN KEY \`FK_class_teachers_teacher\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`class_teachers\` DROP FOREIGN KEY \`FK_class_teachers_class\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`class_teachers\` DROP FOREIGN KEY \`FK_class_teachers_school\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`teacher_subjects\` DROP FOREIGN KEY \`FK_teacher_subjects_subject\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`teacher_subjects\` DROP FOREIGN KEY \`FK_teacher_subjects_teacher\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`teacher_subjects\` DROP FOREIGN KEY \`FK_teacher_subjects_school\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`subjects\` DROP FOREIGN KEY \`FK_07a82eb883094a6990b914cc15e\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`teachers\` DROP FOREIGN KEY \`FK_5656d1b6d40765ea6b135b35d4b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`teachers\` DROP FOREIGN KEY \`FK_4668d4752e6766682d1be0b346f\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`directors\` DROP FOREIGN KEY \`FK_directors_school_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`directors\` DROP FOREIGN KEY \`FK_directors_user_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_25e1cf8f41bae2f3d11f3c2a028\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`schools\` DROP FOREIGN KEY \`FK_3713afaf59c1448ba5f844b0129\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_a7838d2ba25be1342091b6695f\` ON \`refresh_tokens\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_d5e27da0cd39bc3bb2811fc8ba\` ON \`refresh_tokens\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_3ddc983c5f7bcf132fd8732c3f\` ON \`refresh_tokens\``,
    );
    await queryRunner.query(`DROP TABLE \`refresh_tokens\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_81870af3aa824bf57f352de7c8\` ON \`conduct_requests\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_7ac08d7704e1e0b8eb15869bc2\` ON \`conduct_requests\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_7951f5a1315890925d49af4b9e\` ON \`conduct_requests\``,
    );
    await queryRunner.query(`DROP TABLE \`conduct_requests\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_356a7f5959de05d4dbd8ae0af0\` ON \`grade_edit_requests\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_a4457f6efdc8637d35b3fa5360\` ON \`grade_edit_requests\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_2d32eebf7bc289d3f498d97bb7\` ON \`grade_edit_requests\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_b8c8432ca4b874cb25b73716f0\` ON \`grade_edit_requests\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_801fac5292845740775b34d971\` ON \`grade_edit_requests\``,
    );
    await queryRunner.query(`DROP TABLE \`grade_edit_requests\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_91381ab2c238848ce3490b2a64\` ON \`grades\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_011e8eccc5fb5685680244bf19\` ON \`grades\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_4e40960913bb4a4c059fa9939d\` ON \`grades\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_ae1618ce22f07ef3e5e51d4c9e\` ON \`grades\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_9acca493883cee3b9e8f9e01cd\` ON \`grades\``,
    );
    await queryRunner.query(`DROP TABLE \`grades\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_76a9d66500d533560f5975a47f\` ON \`activity_reports\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_4a1b5439913a301b965165bb92\` ON \`activity_reports\``,
    );
    await queryRunner.query(`DROP TABLE \`activity_reports\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_class_teachers_unique\` ON \`class_teachers\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_class_teachers_school\` ON \`class_teachers\``,
    );
    await queryRunner.query(`DROP TABLE \`class_teachers\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_teacher_subjects_unique\` ON \`teacher_subjects\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_teacher_subjects_school\` ON \`teacher_subjects\``,
    );
    await queryRunner.query(`DROP TABLE \`teacher_subjects\``);
    await queryRunner.query(
      `DROP INDEX \`REL_fb3eff90b11bddf7285f9b4e28\` ON \`students\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_de6ad4ae6936dce474e2823984\` ON \`students\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_aa8edc7905ad764f8592456964\` ON \`students\``,
    );
    await queryRunner.query(`DROP TABLE \`students\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_e29ecb29e836d3ac17735de80d\` ON \`timetable_slots\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_413d6d03d85327b1023dc8548a\` ON \`timetable_slots\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_da4356c886fae446a536a69f1b\` ON \`timetable_slots\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_173fac1c846b3efb3fdb4dbdaa\` ON \`timetable_slots\``,
    );
    await queryRunner.query(`DROP TABLE \`timetable_slots\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_3fdf1942e351a8c1702c3b7dd5\` ON \`school_classes\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_8e1e4aefbf8e2fc2f2ae449a74\` ON \`school_classes\``,
    );
    await queryRunner.query(`DROP TABLE \`school_classes\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_07a82eb883094a6990b914cc15\` ON \`subjects\``,
    );
    await queryRunner.query(`DROP TABLE \`subjects\``);
    await queryRunner.query(
      `DROP INDEX \`REL_4668d4752e6766682d1be0b346\` ON \`teachers\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_5656d1b6d40765ea6b135b35d4\` ON \`teachers\``,
    );
    await queryRunner.query(`DROP TABLE \`teachers\``);
    await queryRunner.query(
      `DROP INDEX \`REL_directors_user_id\` ON \`directors\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_directors_school_id\` ON \`directors\``,
    );
    await queryRunner.query(`DROP TABLE \`directors\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_25e1cf8f41bae2f3d11f3c2a02\` ON \`users\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\` ON \`users\``,
    );
    await queryRunner.query(`DROP TABLE \`users\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_3713afaf59c1448ba5f844b012\` ON \`schools\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_150b12170135ff067a24ea270d\` ON \`schools\``,
    );
    await queryRunner.query(`DROP TABLE \`schools\``);
  }
}
