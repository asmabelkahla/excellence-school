import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassSubject } from '../academics/entities';
import { AuthModule } from '../auth/auth.module';
import { ClassTeacher } from '../entities/class-teacher.entity';
import { ParentStudent } from '../entities/parent-student.entity';
import { Student } from '../entities/student.entity';
import { User } from '../entities/user.entity';
import { Conversation, ConversationRead, Message } from './entities';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

export const MESSAGING_ENTITIES = [Conversation, Message, ConversationRead];

@Module({
  imports: [
    TypeOrmModule.forFeature([...MESSAGING_ENTITIES, ParentStudent, Student, User, ClassTeacher, ClassSubject]),
    AuthModule,
  ],
  controllers: [MessagingController],
  providers: [MessagingService],
})
export class MessagingModule {}
