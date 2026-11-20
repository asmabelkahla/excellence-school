import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { SchoolClass } from './class.entity';
import { User } from './user.entity';

@Entity('class_teachers')
export class ClassTeacher {
  @PrimaryColumn('text')
  class_id: string;

  @PrimaryColumn('text')
  teacher_id: string;

  @ManyToOne(() => SchoolClass, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  schoolClass: SchoolClass;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;
}
