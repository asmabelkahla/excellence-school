import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export const PARENT_RELATIONSHIPS = ['mere', 'pere', 'tuteur'] as const;
export type ParentRelationship = (typeof PARENT_RELATIONSHIPS)[number];

@Entity('link_requests')
export class LinkRequest {
  @PrimaryColumn('text')
  id: string;

  @Column({ type: 'text' })
  parent_id: string;

  @Column({ type: 'text', nullable: true })
  parent_name: string | null;

  @Column({ type: 'text', nullable: true })
  parent_phone: string | null;

  @Column({ type: 'text', nullable: true })
  parent_email: string | null;

  @Column({ type: 'text' })
  child_first_name: string;

  @Column({ type: 'text' })
  child_last_name: string;

  @Column({ type: 'text', nullable: true })
  declared_class_id: string | null;

  @Column({ type: 'text', nullable: true })
  declared_class_name: string | null;

  @Column({ type: 'text', nullable: true })
  relationship: ParentRelationship | null;

  @Column({ type: 'text', nullable: true })
  student_id: string | null;

  @Column({ type: 'text', default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';

  @Column({ type: 'text', nullable: true })
  admin_note: string | null;

  /** Set when the request is approved or refused. */
  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
