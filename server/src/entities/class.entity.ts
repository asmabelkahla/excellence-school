import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('classes')
export class SchoolClass {
  @PrimaryColumn('text')
  id: string;

  @Column({ type: 'text', nullable: true })
  school_year_id: string | null;

  @Column({ type: 'text', nullable: true })
  level_id: string | null;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'integer', default: 0 })
  student_count: number;
}
