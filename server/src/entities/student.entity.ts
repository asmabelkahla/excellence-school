import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('students')
export class Student {
  @PrimaryColumn('text')
  id: string;

  @Column({ type: 'text' })
  first_name: string;

  @Column({ type: 'text' })
  last_name: string;

  @Column({ type: 'text', nullable: true })
  first_name_ar: string | null;

  @Column({ type: 'text', nullable: true })
  last_name_ar: string | null;

  @Column({ type: 'date', nullable: true })
  birth_date: string | null;

  @Column({ type: 'text', nullable: true })
  gender: string | null;

  @Column({ type: 'text', nullable: true })
  class_id: string | null;

  @Column({ type: 'text', nullable: true })
  class_name: string | null;

  @Column({ type: 'text', nullable: true })
  level_id: string | null;
}
