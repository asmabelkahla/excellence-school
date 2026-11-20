import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import { ClassSubject } from '../academics/entities';
import { ClassTeacher } from '../entities/class-teacher.entity';
import { ParentStudent } from '../entities/parent-student.entity';
import { Student } from '../entities/student.entity';
import { User, UserRole } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Conversation, ConversationRead, Message } from './entities';
import { PostMessageDto, StartConversationDto } from './messages.dto';

export interface Actor {
  id: string;
  role: UserRole;
}

/**
 * Parent <-> teacher threads, one per (student, teacher).
 * Readers: that teacher, and the parents currently linked to the student. Nobody else.
 */
@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Conversation) private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(ConversationRead) private readonly reads: Repository<ConversationRead>,
    @InjectRepository(ParentStudent) private readonly links: Repository<ParentStudent>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ClassTeacher) private readonly classTeachers: Repository<ClassTeacher>,
    @InjectRepository(ClassSubject) private readonly classSubjects: Repository<ClassSubject>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  /** Who the actor can write to / about. */
  async contacts(actor: Actor) {
    if (actor.role === 'parent') {
      const links = await this.links.find({ where: { parent_id: actor.id }, relations: { student: true } });
      const result = [];
      for (const link of links.filter(l => l.student)) {
        result.push({
          student_id: link.student.id,
          student_name: `${link.student.first_name} ${link.student.last_name}`,
          class_name: link.student.class_name,
          teachers: await this.teachersOfClass(link.student.class_id),
        });
      }
      return result;
    }

    // Teacher: the students of every class they teach.
    const classIds = await this.classesOfTeacher(actor.id);
    if (!classIds.length) return [];
    const students = await this.students.find({ where: { class_id: In(classIds) }, order: { class_name: 'ASC', last_name: 'ASC' } });
    const linked = await this.links.find({ where: { student_id: In(students.map(s => s.id)) }, select: ['student_id'] });
    const withParents = new Set(linked.map(l => l.student_id));
    return students.map(s => ({
      student_id: s.id,
      student_name: `${s.first_name} ${s.last_name}`,
      class_id: s.class_id,
      class_name: s.class_name,
      has_parent_account: withParents.has(s.id),
    }));
  }

  /** The actor's threads, most recent first, with unread counts. */
  async list(actor: Actor) {
    let threads: Conversation[];
    if (actor.role === 'parent') {
      const studentIds = (await this.links.find({ where: { parent_id: actor.id }, select: ['student_id'] })).map(l => l.student_id);
      threads = studentIds.length ? await this.conversations.find({ where: { student_id: In(studentIds) } }) : [];
    } else {
      threads = await this.conversations.find({ where: { teacher_id: actor.id } });
    }
    if (!threads.length) return [];

    const ids = threads.map(t => t.id);
    const [students, teachers, unread, last] = await Promise.all([
      this.students.find({ where: { id: In(threads.map(t => t.student_id)) } }),
      this.users.find({ where: { id: In(threads.map(t => t.teacher_id)) }, select: ['id', 'full_name'] }),
      this.unreadByConversation(ids, actor.id),
      this.dataSource.query(
        `SELECT DISTINCT ON (conversation_id) conversation_id, body, kind, category, author_id, created_at
           FROM messages WHERE conversation_id = ANY($1) ORDER BY conversation_id, created_at DESC`,
        [ids],
      ) as Promise<{ conversation_id: string; body: string; kind: string; category: string | null; author_id: string; created_at: Date }[]>,
    ]);

    return threads
      .map(t => {
        const st = students.find(s => s.id === t.student_id);
        const lastMessage = last.find(m => m.conversation_id === t.id);
        return {
          id: t.id,
          student_id: t.student_id,
          student_name: st ? `${st.first_name} ${st.last_name}` : '',
          class_name: st?.class_name ?? null,
          teacher_id: t.teacher_id,
          teacher_name: teachers.find(u => u.id === t.teacher_id)?.full_name ?? '',
          last_message_at: t.last_message_at,
          last_message: lastMessage
            ? {
                body: lastMessage.body.slice(0, 140),
                kind: lastMessage.kind,
                category: lastMessage.category,
                from_me: lastMessage.author_id === actor.id,
              }
            : null,
          unread: unread.get(t.id) ?? 0,
        };
      })
      .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
  }

  /** Messages of a thread; opening it marks it as read. */
  async thread(id: string, actor: Actor) {
    const conv = await this.requireAccess(id, actor);
    const [messages, student, teacher] = await Promise.all([
      this.messages.find({ where: { conversation_id: id }, order: { created_at: 'ASC' } }),
      this.students.findOne({ where: { id: conv.student_id } }),
      this.users.findOne({ where: { id: conv.teacher_id }, select: ['id', 'full_name'] }),
    ]);
    const authors = await this.users.find({
      where: { id: In([...new Set(messages.map(m => m.author_id))]) },
      select: ['id', 'full_name', 'role'],
    });
    await this.markRead(id, actor.id);

    return {
      id: conv.id,
      student_id: conv.student_id,
      student_name: student ? `${student.first_name} ${student.last_name}` : '',
      class_name: student?.class_name ?? null,
      teacher_id: conv.teacher_id,
      teacher_name: teacher?.full_name ?? '',
      messages: messages.map(m => {
        const author = authors.find(a => a.id === m.author_id);
        return {
          id: m.id,
          kind: m.kind,
          category: m.category,
          body: m.body,
          created_at: m.created_at,
          author_name: author?.full_name ?? '',
          author_role: author?.role ?? null,
          from_me: m.author_id === actor.id,
        };
      }),
    };
  }

  /** Opens (or reuses) the thread for a student and a teacher, with a first message. */
  async start(dto: StartConversationDto, actor: Actor) {
    const student = await this.students.findOne({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Élève introuvable.');

    let teacherId: string;
    if (actor.role === 'parent') {
      if (!(await this.isLinked(actor.id, student.id))) {
        throw new ForbiddenException('Cet enfant n’est pas rattaché à votre compte.');
      }
      if (!dto.teacherId) throw new BadRequestException('Choisissez l’enseignant.');
      const teachers = await this.teachersOfClass(student.class_id);
      if (!teachers.some(t => t.id === dto.teacherId)) {
        throw new ForbiddenException('Cet enseignant n’enseigne pas dans la classe de votre enfant.');
      }
      teacherId = dto.teacherId;
    } else {
      if (!student.class_id || !(await this.classesOfTeacher(actor.id)).includes(student.class_id)) {
        throw new ForbiddenException('Cet élève n’est pas dans une de vos classes.');
      }
      teacherId = actor.id;
    }

    let conv = await this.conversations.findOne({ where: { student_id: student.id, teacher_id: teacherId } });
    if (!conv) {
      conv = await this.conversations.save({
        id: `conv-${randomUUID()}`,
        student_id: student.id,
        teacher_id: teacherId,
        created_by: actor.id,
        created_at: new Date(),
        last_message_at: new Date(),
      });
    }
    await this.post(conv.id, dto, actor);
    return this.thread(conv.id, actor);
  }

  async post(id: string, dto: PostMessageDto, actor: Actor) {
    const conv = await this.requireAccess(id, actor);
    const kind = dto.kind ?? 'message';
    if (kind === 'note' && actor.role !== 'teacher') {
      throw new ForbiddenException('Seul un enseignant peut laisser une note sur un élève.');
    }
    const now = new Date();
    await this.dataSource.transaction(async manager => {
      await manager.getRepository(Message).insert({
        id: `msg-${randomUUID()}`,
        conversation_id: conv.id,
        author_id: actor.id,
        kind,
        category: kind === 'note' ? dto.category ?? 'information' : null,
        body: dto.body,
        created_at: now,
      });
      await manager.getRepository(Conversation).update(conv.id, { last_message_at: now });
      // The author has obviously read their own message.
      await manager.getRepository(ConversationRead).save({ conversation_id: conv.id, user_id: actor.id, last_read_at: now });
    });
    await this.notifyOtherSide(conv, actor, kind, dto.body);
    return this.thread(conv.id, actor);
  }

  async unreadCount(actor: Actor) {
    const threads = await this.list(actor);
    return { unread: threads.reduce((n, t) => n + t.unread, 0) };
  }

  /** Teacher writes → the student's parents; a parent writes → the teacher. */
  private async notifyOtherSide(conv: Conversation, actor: Actor, kind: 'message' | 'note', body: string) {
    const [student, author] = await Promise.all([
      this.students.findOne({ where: { id: conv.student_id } }),
      this.users.findOne({ where: { id: actor.id }, select: ['id', 'full_name'] }),
    ]);
    const preview = body.length > 120 ? body.slice(0, 117) + '…' : body;
    if (actor.role === 'teacher') {
      const parents = (await this.links.find({ where: { student_id: conv.student_id }, select: ['parent_id'] })).map(l => l.parent_id);
      await this.notifications.notify(parents, {
        type: 'message',
        title: kind === 'note' ? `📝 Note de ${author?.full_name ?? 'l’enseignant'}` : `💬 Message de ${author?.full_name ?? 'l’enseignant'}`,
        body: `${student?.first_name ?? ''} : ${preview}`,
        link: `/parent/messages?c=${conv.id}`,
        studentId: conv.student_id,
      });
    } else {
      await this.notifications.notify([conv.teacher_id], {
        type: 'message',
        title: `💬 ${author?.full_name ?? 'Un parent'} (${student ? student.first_name + ' ' + student.last_name : 'élève'})`,
        body: preview,
        link: `/teacher/messages?c=${conv.id}`,
        studentId: conv.student_id,
      });
    }
  }

  // ---------------------------------------------------------------- access

  private async requireAccess(id: string, actor: Actor) {
    const conv = await this.conversations.findOne({ where: { id } });
    // Same answer whether the thread does not exist or is not yours: no information leak.
    const allowed =
      !!conv &&
      ((actor.role === 'teacher' && conv.teacher_id === actor.id) ||
        (actor.role === 'parent' && (await this.isLinked(actor.id, conv.student_id))));
    if (!allowed) throw new NotFoundException('Conversation introuvable.');
    return conv!;
  }

  private async isLinked(parentId: string, studentId: string) {
    return (await this.links.count({ where: { parent_id: parentId, student_id: studentId } })) > 0;
  }

  private async classesOfTeacher(teacherId: string): Promise<string[]> {
    const [ct, cs] = await Promise.all([
      this.classTeachers.find({ where: { teacher_id: teacherId }, select: ['class_id'] }),
      this.classSubjects.find({ where: { teacher_id: teacherId }, select: ['class_id'] }),
    ]);
    return [...new Set([...ct.map(c => c.class_id), ...cs.map(c => c.class_id)])];
  }

  /** Teachers of a class (class teachers + subject teachers), with what they teach. */
  private async teachersOfClass(classId: string | null) {
    if (!classId) return [];
    const [ct, cs] = await Promise.all([
      this.classTeachers.find({ where: { class_id: classId } }),
      this.classSubjects.find({ where: { class_id: classId }, relations: { subject: true } }),
    ]);
    const ids = [...new Set([...ct.map(c => c.teacher_id), ...cs.map(c => c.teacher_id).filter((x): x is string => !!x)])];
    if (!ids.length) return [];
    const users = await this.users.find({ where: { id: In(ids), role: 'teacher', active: true }, select: ['id', 'full_name'] });
    return users
      .map(u => ({
        id: u.id,
        full_name: u.full_name,
        subjects: cs.filter(c => c.teacher_id === u.id).map(c => c.subject?.name_fr).filter(Boolean) as string[],
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr'));
  }

  private async markRead(conversationId: string, userId: string) {
    await this.reads.save({ conversation_id: conversationId, user_id: userId, last_read_at: new Date() });
  }

  private async unreadByConversation(ids: string[], userId: string) {
    const rows: { conversation_id: string; count: string }[] = await this.dataSource.query(
      `SELECT m.conversation_id, COUNT(*) AS count
         FROM messages m
         LEFT JOIN conversation_reads r ON r.conversation_id = m.conversation_id AND r.user_id = $2
        WHERE m.conversation_id = ANY($1)
          AND m.author_id <> $2
          AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
        GROUP BY m.conversation_id`,
      [ids, userId],
    );
    return new Map(rows.map(r => [r.conversation_id, Number(r.count)]));
  }
}
