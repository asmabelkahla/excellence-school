import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { randomUUID } from 'crypto';
import { Column, Entity, LessThanOrEqual, MoreThanOrEqual, PrimaryColumn, Repository } from 'typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User } from '../entities/user.entity';

export const EVENT_CATEGORIES = ['reunion', 'examen', 'vacances', 'fete', 'sortie', 'autre'] as const;
export const EVENT_VISIBILITIES = ['public', 'private'] as const;
/** Who may create, edit and delete events. Everyone signed in may read (parents: public only). */
const EDITORS = ['admin', 'moderator'];

@Entity('school_events')
export class SchoolEvent {
  @PrimaryColumn('text') id: string;
  @Column('text') title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column('text') category: (typeof EVENT_CATEGORIES)[number];
  @Column('text') visibility: (typeof EVENT_VISIBILITIES)[number];
  @Column('timestamptz') starts_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) ends_at: Date | null;
  @Column('boolean') all_day: boolean;
  @Column({ type: 'text', nullable: true }) created_by: string | null;
  @Column({ type: 'timestamptz', default: () => 'NOW()' }) created_at: Date;
  @Column({ type: 'timestamptz', default: () => 'NOW()' }) updated_at: Date;
}

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateEventDto {
  @Transform(trim) @IsString() @IsNotEmpty({ message: 'Le titre est obligatoire.' }) @MaxLength(120)
  title: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000)
  description?: string;

  @IsIn(EVENT_CATEGORIES, { message: 'Catégorie invalide.' })
  category: (typeof EVENT_CATEGORIES)[number];

  @IsIn(EVENT_VISIBILITIES, { message: 'Visibilité invalide (public ou private).' })
  visibility: (typeof EVENT_VISIBILITIES)[number];

  @IsDateString({}, { message: 'Date de début invalide.' })
  startsAt: string;

  @IsOptional() @IsDateString({}, { message: 'Date de fin invalide.' })
  endsAt?: string | null;

  @IsBoolean()
  allDay: boolean;
}

export class UpdateEventDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty({ message: 'Le titre ne peut pas être vide.' }) @MaxLength(120)
  title?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000)
  description?: string;

  @IsOptional() @IsIn(EVENT_CATEGORIES, { message: 'Catégorie invalide.' })
  category?: (typeof EVENT_CATEGORIES)[number];

  @IsOptional() @IsIn(EVENT_VISIBILITIES, { message: 'Visibilité invalide (public ou private).' })
  visibility?: (typeof EVENT_VISIBILITIES)[number];

  @IsOptional() @IsDateString({}, { message: 'Date de début invalide.' })
  startsAt?: string;

  @IsOptional() @IsDateString({}, { message: 'Date de fin invalide.' })
  endsAt?: string | null;

  @IsOptional() @IsBoolean()
  allDay?: boolean;
}

const DAY = 24 * 3600 * 1000;

@Injectable()
export class CalendarService {
  constructor(@InjectRepository(SchoolEvent) private readonly events: Repository<SchoolEvent>) {}

  /**
   * Events overlapping [from, to]. Parents only ever receive public events:
   * the filter is applied here, on the server, not in the screen.
   */
  async list(role: string, fromIso?: string, toIso?: string) {
    const from = fromIso ? new Date(fromIso) : new Date(Date.now() - 31 * DAY);
    const to = toIso ? new Date(toIso) : new Date(Date.now() + 62 * DAY);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      throw new BadRequestException('Période invalide.');
    }
    if (to.getTime() - from.getTime() > 400 * DAY) throw new BadRequestException('Période trop longue (400 jours maximum).');

    const qb = this.events
      .createQueryBuilder('e')
      .where('e.starts_at <= :to', { to })
      .andWhere('COALESCE(e.ends_at, e.starts_at) >= :from', { from })
      .orderBy('e.starts_at', 'ASC');
    if (role === 'parent') qb.andWhere("e.visibility = 'public'");
    const list = await qb.getMany();
    return list.map(e => this.view(e, role));
  }

  async create(dto: CreateEventDto, userId: string) {
    const { starts, ends } = this.range(dto.startsAt, dto.endsAt ?? null);
    const saved = await this.events.save({
      id: `evt-${randomUUID()}`,
      title: dto.title,
      description: dto.description || null,
      category: dto.category,
      visibility: dto.visibility,
      starts_at: starts,
      ends_at: ends,
      all_day: dto.allDay,
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    });
    return this.view(saved, 'admin');
  }

  async update(id: string, dto: UpdateEventDto) {
    const evt = await this.events.findOne({ where: { id } });
    if (!evt) throw new NotFoundException('Événement introuvable.');
    if (dto.title !== undefined) evt.title = dto.title;
    if (dto.description !== undefined) evt.description = dto.description || null;
    if (dto.category !== undefined) evt.category = dto.category;
    if (dto.visibility !== undefined) evt.visibility = dto.visibility;
    if (dto.allDay !== undefined) evt.all_day = dto.allDay;
    if (dto.startsAt !== undefined || dto.endsAt !== undefined) {
      const { starts, ends } = this.range(
        dto.startsAt ?? evt.starts_at.toISOString(),
        dto.endsAt !== undefined ? dto.endsAt : evt.ends_at?.toISOString() ?? null,
      );
      evt.starts_at = starts;
      evt.ends_at = ends;
    }
    evt.updated_at = new Date();
    return this.view(await this.events.save(evt), 'admin');
  }

  async remove(id: string) {
    const result = await this.events.delete({ id });
    if (!result.affected) throw new NotFoundException('Événement introuvable.');
    return { deleted: true };
  }

  private range(startIso: string, endIso: string | null) {
    const starts = new Date(startIso);
    const ends = endIso ? new Date(endIso) : null;
    if (ends && ends < starts) throw new BadRequestException('La fin doit être après le début.');
    return { starts, ends };
  }

  /** Parents never see who created an event. */
  private view(e: SchoolEvent, role: string) {
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      category: e.category,
      visibility: e.visibility,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      all_day: e.all_day,
      ...(role === 'parent' ? {} : { created_by: e.created_by, updated_at: e.updated_at }),
    };
  }
}

@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  @Roles('admin', 'moderator', 'econome', 'teacher', 'parent')
  list(@Req() req: AuthenticatedRequest, @Query('from') from?: string, @Query('to') to?: string) {
    return this.calendar.list(req.user.role, from, to);
  }

  @Post()
  @Roles(...EDITORS)
  create(@Body() dto: CreateEventDto, @Req() req: AuthenticatedRequest) {
    return this.calendar.create(dto, req.user.sub);
  }

  @Patch(':id')
  @Roles(...EDITORS)
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.calendar.update(id, dto);
  }

  @Delete(':id')
  @Roles(...EDITORS)
  remove(@Param('id') id: string) {
    return this.calendar.remove(id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([SchoolEvent, User]), AuthModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
