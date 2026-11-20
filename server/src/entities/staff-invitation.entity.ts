import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('staff_invitations')
export class StaffInvitation {
  @PrimaryColumn('text')
  id: string;

  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'text' })
  role: 'admin' | 'moderator' | 'econome' | 'teacher';

  @Column({ type: 'text' })
  full_name: string;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ type: 'text', default: 'pending' })
  status: 'pending' | 'accepted' | 'expired';

  @Column({ type: 'text' })
  invited_by_id: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  invited_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  accepted_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at: Date | null;
}
