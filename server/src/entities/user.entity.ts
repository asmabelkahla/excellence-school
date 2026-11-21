import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type UserRole = 'admin' | 'moderator' | 'econome' | 'teacher' | 'parent';
export const STAFF_ROLES = ['admin', 'moderator', 'econome', 'teacher'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

@Entity('users')
export class User {
  @PrimaryColumn('text')
  id: string;

  @Column({ type: 'text' })
  role: UserRole;

  @Column({ type: 'text' })
  full_name: string;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true, unique: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  password: string | null;

  @Column({ type: 'text', default: 'fr' })
  locale: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true })
  avatar_url: string | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'boolean', default: false })
  is_super_admin: boolean;

  @Column({ type: 'text', nullable: true })
  invited_by_id: string | null;

  /** Set when an admin creates the account or resets its password. */
  @Column({ type: 'boolean', default: false })
  must_change_password: boolean;

  /** Tokens issued before this instant are rejected (set on every password change). */
  @Column({ type: 'timestamptz', nullable: true, select: false })
  tokens_valid_after: Date | null;

  /** Linked Google account (ID token "sub"). Never sent to the client. */
  @Column({ type: 'text', nullable: true, unique: true, select: false })
  google_sub: string | null;
}
