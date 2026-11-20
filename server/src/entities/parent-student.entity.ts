import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Student } from './student.entity';
import { User } from './user.entity';

@Entity('parent_students')
export class ParentStudent {
  @PrimaryColumn('text')
  parent_id: string;

  @PrimaryColumn('text')
  student_id: string;

  @Column({ type: 'text' })
  relationship: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent: User;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;
}
