import { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordResetTokens1792672983276 implements MigrationInterface {
  name = 'PasswordResetTokens1792672983276';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`password_reset_tokens\` (\`id\` int NOT NULL AUTO_INCREMENT, \`user_id\` int NOT NULL, \`token_hash\` char(64) NOT NULL, \`expires_at\` datetime NOT NULL, \`used_at\` datetime NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_password_reset_user_id\` (\`user_id\`), UNIQUE INDEX \`IDX_password_reset_token_hash\` (\`token_hash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`password_reset_tokens\` ADD CONSTRAINT \`FK_password_reset_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`password_reset_tokens\` DROP FOREIGN KEY \`FK_password_reset_user_id\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_password_reset_token_hash\` ON \`password_reset_tokens\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_password_reset_user_id\` ON \`password_reset_tokens\``,
    );
    await queryRunner.query(`DROP TABLE \`password_reset_tokens\``);
  }
}
