import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import { SchoolClass } from '../entities/class.entity';
import { ClassTeacher } from '../entities/class-teacher.entity';
import { Student } from '../entities/student.entity';
import { User } from '../entities/user.entity';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { ClassSubject, Subject } from '../academics/entities';

/** Default coefficients of the Tunisian primary programme; everything else counts 1. */
const DEFAULT_COEFFICIENTS: Record<string, number> = { 'sbj-math': 2, 'sbj-sci': 1.5, 'sbj-fr': 1.5 };
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';

export interface ClassView {
  id: string;
  name: string;
  level_id: string | null;
  school_year_id: string | null;
  student_count: number;
  teachers: { id: string; full_name: string }[];
}

const newId = (prefix: string) => `${prefix}-${randomUUID()}`;

@Injectable()
export class SchoolService {
  constructor(
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(SchoolClass) private readonly classes: Repository<SchoolClass>,
    @InjectRepository(ClassTeacher) private readonly classTeachers: Repository<ClassTeacher>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  // ------------------------------------------------------------- students

  listStudents() {
    return this.students.find({
      select: ['id', 'first_name', 'last_name', 'first_name_ar', 'last_name_ar', 'gender', 'birth_date', 'class_id', 'class_name', 'level_id'],
      order: { last_name: 'ASC', first_name: 'ASC' },
    });
  }

  async createStudent(dto: CreateStudentDto) {
    const cls = await this.requireClass(dto.classId);
    const student = this.students.create({
      id: newId('std'),
      first_name: dto.firstName,
      last_name: dto.lastName,
      first_name_ar: dto.firstNameAr || null,
      last_name_ar: dto.lastNameAr || null,
      gender: dto.gender,
      class_id: cls.id,
      class_name: cls.name,
      level_id: cls.level_id,
    });
    return this.students.save(student);
  }

  async updateStudent(id: string, dto: UpdateStudentDto) {
    const student = await this.students.findOne({ where: { id } });
    if (!student) throw new NotFoundException('Élève introuvable.');

    if (dto.firstName !== undefined) student.first_name = dto.firstName;
    if (dto.lastName !== undefined) student.last_name = dto.lastName;
    if (dto.gender !== undefined) student.gender = dto.gender;
    if (dto.firstNameAr !== undefined) student.first_name_ar = dto.firstNameAr || null;
    if (dto.lastNameAr !== undefined) student.last_name_ar = dto.lastNameAr || null;
    if (dto.classId !== undefined && dto.classId !== student.class_id) {
      const cls = await this.requireClass(dto.classId);
      student.class_id = cls.id;
      student.class_name = cls.name;
      student.level_id = cls.level_id;
    }
    return this.students.save(student);
  }

  async deleteStudent(id: string) {
    // parent_students rows go away through ON DELETE CASCADE.
    const result = await this.students.delete({ id });
    if (!result.affected) throw new NotFoundException('Élève introuvable.');
    return { deleted: true };
  }

  // -------------------------------------------------------------- classes

  async listClasses(): Promise<ClassView[]> {
    const classes = await this.classes.find({ order: { level_id: 'ASC', name: 'ASC' } });
    if (classes.length === 0) return [];
    const ids = classes.map(c => c.id);

    const counts: { class_id: string; count: string }[] = await this.students
      .createQueryBuilder('s')
      .select('s.class_id', 'class_id')
      .addSelect('COUNT(*)', 'count')
      .where('s.class_id IN (:...ids)', { ids })
      .groupBy('s.class_id')
      .getRawMany();
    const countByClass = new Map(counts.map(c => [c.class_id, Number(c.count)]));

    const links = await this.classTeachers.find({ where: { class_id: In(ids) }, relations: { teacher: true } });
    const teachersByClass = new Map<string, { id: string; full_name: string }[]>();
    for (const link of links) {
      if (!link.teacher) continue;
      const list = teachersByClass.get(link.class_id) ?? [];
      list.push({ id: link.teacher.id, full_name: link.teacher.full_name });
      teachersByClass.set(link.class_id, list);
    }

    return classes.map(c => ({
      id: c.id,
      name: c.name,
      level_id: c.level_id,
      school_year_id: c.school_year_id,
      student_count: countByClass.get(c.id) ?? 0,
      teachers: (teachersByClass.get(c.id) ?? []).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    }));
  }

  listTeachers() {
    return this.users.find({
      select: ['id', 'full_name', 'email'],
      where: { role: 'teacher', active: true },
      order: { full_name: 'ASC' },
    });
  }

  async createClass(dto: CreateClassDto): Promise<ClassView> {
    await this.assertUniqueName(dto.name);
    const teacherIds = await this.requireTeachers(dto.teacherIds ?? []);
    const id = newId('cls');

    await this.dataSource.transaction(async manager => {
      await manager.getRepository(SchoolClass).insert({
        id,
        name: dto.name,
        level_id: dto.levelId,
        school_year_id: this.config.get<string>('CURRENT_SCHOOL_YEAR_ID', 'sy-2026'),
        student_count: 0,
      });
      if (teacherIds.length) {
        await manager.getRepository(ClassTeacher).insert(teacherIds.map(teacher_id => ({ class_id: id, teacher_id })));
      }
      // Every subject of the programme, taught by the main class teacher by default,
      // so grades and homework can be entered straight away.
      const subjects = await manager.getRepository(Subject).find();
      if (subjects.length) {
        await manager.getRepository(ClassSubject).insert(subjects.map(sbj => ({
          id: `cs-${randomUUID()}`,
          class_id: id,
          subject_id: sbj.id,
          teacher_id: teacherIds[0] ?? null,
          coefficient: DEFAULT_COEFFICIENTS[sbj.id] ?? 1,
        })));
      }
    });
    return this.getClassView(id);
  }

  async updateClass(id: string, dto: UpdateClassDto): Promise<ClassView> {
    const cls = await this.requireClass(id);
    if (dto.name !== undefined && dto.name.toLowerCase() !== cls.name.toLowerCase()) {
      await this.assertUniqueName(dto.name, id);
    }
    const teacherIds = dto.teacherIds ? await this.requireTeachers(dto.teacherIds) : null;

    await this.dataSource.transaction(async manager => {
      const changes: Partial<SchoolClass> = {};
      if (dto.name !== undefined) changes.name = dto.name;
      if (dto.levelId !== undefined) changes.level_id = dto.levelId;
      if (Object.keys(changes).length) {
        await manager.getRepository(SchoolClass).update(id, changes);
        // Students keep a denormalised copy of their class name and level.
        await manager.getRepository(Student).update(
          { class_id: id },
          { class_name: changes.name ?? cls.name, level_id: changes.level_id ?? cls.level_id },
        );
      }
      if (teacherIds) {
        // Subjects taught by the former main teacher (or by nobody) follow the new main teacher.
        const previous = await manager.getRepository(ClassTeacher).find({ where: { class_id: id }, order: { teacher_id: 'ASC' } });
        const formerMain = previous[0]?.teacher_id ?? null;
        const newMain = teacherIds[0] ?? null;
        if (formerMain !== newMain) {
          await manager.getRepository(ClassSubject)
            .createQueryBuilder()
            .update()
            .set({ teacher_id: newMain })
            .where('class_id = :id', { id })
            .andWhere(formerMain ? '(teacher_id IS NULL OR teacher_id = :formerMain)' : 'teacher_id IS NULL', { formerMain })
            .execute();
        }
        await manager.getRepository(ClassTeacher).delete({ class_id: id });
        if (teacherIds.length) {
          await manager.getRepository(ClassTeacher).insert(teacherIds.map(teacher_id => ({ class_id: id, teacher_id })));
        }
      }
    });
    return this.getClassView(id);
  }

  async deleteClass(id: string) {
    const cls = await this.requireClass(id);
    const studentCount = await this.students.count({ where: { class_id: id } });
    if (studentCount > 0) {
      throw new ConflictException(
        `La classe ${cls.name} contient encore ${studentCount} élève(s). Changez-les de classe avant de la supprimer.`,
      );
    }
    await this.classes.delete({ id }); // class_teachers rows cascade.
    return { deleted: true };
  }

  // -------------------------------------------------------------- helpers

  private async getClassView(id: string): Promise<ClassView> {
    const view = (await this.listClasses()).find(c => c.id === id);
    if (!view) throw new NotFoundException('Classe introuvable.');
    return view;
  }

  private async requireClass(id: string) {
    const cls = await this.classes.findOne({ where: { id } });
    if (!cls) throw new NotFoundException('Classe introuvable.');
    return cls;
  }

  private async assertUniqueName(name: string, exceptId?: string) {
    const existing = await this.classes
      .createQueryBuilder('c')
      .where('LOWER(c.name) = LOWER(:name)', { name })
      .getOne();
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(`Une classe nommée « ${existing.name} » existe déjà.`);
    }
  }

  private async requireTeachers(ids: string[]) {
    if (ids.length === 0) return [];
    const found = await this.users.find({ select: ['id'], where: { id: In(ids), role: 'teacher' } });
    if (found.length !== ids.length) {
      throw new BadRequestException('Un des enseignants sélectionnés est introuvable.');
    }
    return ids;
  }
}
