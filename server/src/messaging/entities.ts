import { Column, Entity, PrimaryColumn } from 'typeorm';

export const MESSAGE_CATEGORIES = ['encouragement', 'travail', 'comportement', 'information'] as const;
export type MessageCategory = (typeof MESSAGE_CATEGORIES)[number];

@Entity('conversations')
export class Conversation {
  @PrimaryColumn('text') id: string;
  @Column('text') student_id: string;
  @Column('text') teacher_id: string;
  @Column('text') created_by: string;
  @Column({ type: 'timestamptz', default: () => 'NOW()' }) created_at: Date;
  @Column({ type: 'timestamptz', default: () => 'NOW()' }) last_message_at: Date;
}

@Entity('messages')
export class Message {
  @PrimaryColumn('text') id: string;
  @Column('text') conversation_id: string;
  @Column('text') author_id: string;
  @Column('text') kind: 'message' | 'note';
  @Column({ type: 'text', nullable: true }) category: MessageCategory | null;
  @Column('text') body: string;
  @Column({ type: 'timestamptz', default: () => 'NOW()' }) created_at: Date;
}

@Entity('conversation_reads')
export class ConversationRead {
  @PrimaryColumn('text') conversation_id: string;
  @PrimaryColumn('text') user_id: string;
  @Column('timestamptz') last_read_at: Date;
}
