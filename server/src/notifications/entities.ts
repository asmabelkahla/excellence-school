import { Column, Entity, PrimaryColumn } from 'typeorm';

export type NotificationType = 'homework' | 'message' | 'report_card' | 'info';

@Entity('notifications')
export class NotificationEntity {
  @PrimaryColumn('text') id: string;
  @Column('text') user_id: string;
  @Column('text') type: NotificationType;
  @Column('text') title: string;
  @Column('text') body: string;
  @Column({ type: 'text', nullable: true }) link: string | null;
  @Column({ type: 'text', nullable: true }) student_id: string | null;
  @Column({ type: 'timestamptz', default: () => 'NOW()' }) created_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) read_at: Date | null;
}

@Entity('push_subscriptions')
export class PushSubscriptionEntity {
  @PrimaryColumn('text') endpoint: string;
  @Column('text') user_id: string;
  @Column('text') p256dh: string;
  @Column('text') auth: string;
  @Column({ type: 'text', nullable: true }) user_agent: string | null;
  @Column({ type: 'timestamptz', default: () => 'NOW()' }) created_at: Date;
}
