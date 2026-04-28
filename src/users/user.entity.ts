import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'bigint' })
  telegramId: string;

  @Column()
  firstName: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  jiraEmail: string;

  @Column({ default: false })
  isPm: boolean;
}
