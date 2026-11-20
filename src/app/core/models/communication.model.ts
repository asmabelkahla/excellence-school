import { NewsCategory, AppointmentStatus, AttendanceStatus } from './school.model';

export interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name?: string;
  class_id: string;
  day: string; // YYYY-MM-DD
  status: AttendanceStatus; // 'present' | 'absent' | 'late'
  recorded_by?: string;
  justification?: AttendanceJustification;
  created_at?: string;
}

export interface AttendanceJustification {
  id: string;
  attendance_id: string;
  parent_id: string;
  reason: string;
  attachment_path?: string;
  created_at: string;
}

export interface HomeworkItem {
  id: string;
  class_id: string;
  class_name?: string;
  class_subject_id?: string;
  subject_name?: string;
  subject_name_ar?: string;
  teacher_id: string;
  teacher_name?: string;
  title: string;
  description?: string;
  due_date: string;
  attachment_path?: string;
  target_student_ids?: string[];
  is_done?: boolean; // computed for current student
  created_at: string;
}

export interface TimetableSlot {
  id: string;
  class_id: string;
  class_subject_id?: string;
  subject_name?: string;
  subject_name_ar?: string;
  teacher_name?: string;
  weekday: number; // 1 = Monday to 6 = Saturday
  starts_at: string; // "08:30"
  ends_at: string; // "10:00"
  room?: string;
}

export interface EventItem {
  id: string;
  title: string;
  description?: string;
  starts_at: string;
  ends_at?: string;
  all_day: boolean;
  category: 'vacances' | 'examen' | 'reunion' | 'fete' | 'sortie' | 'autre';
  class_id?: string;
  created_by?: string;
  /** public = parents see it; private = staff only. */
  visibility?: 'public' | 'private';
}

export interface NewsItem {
  id: string;
  title_fr: string;
  title_ar?: string;
  body_fr?: string;
  body_ar?: string;
  category: NewsCategory;
  cover_path?: string;
  media_paths?: string[];
  target_level_id?: string;
  target_class_id?: string;
  pinned: boolean;
  published: boolean;
  publish_at: string;
  created_by?: string;
  created_at: string;
}

export interface ReviewItem {
  id: string;
  author_name: string;
  category: 'general' | 'service' | 'school-life' | 'logistics';
  title: string;
  message: string;
  status: 'pending' | 'published' | 'archived';
  created_at: string;
}

export interface Appointment {
  id: string;
  parent_id: string;
  parent_name?: string;
  parent_phone?: string;
  student_id: string;
  student_name?: string;
  class_id: string;
  class_name?: string;
  teacher_id: string;
  teacher_name?: string;
  subject_name?: string;
  reason: string;
  note?: string;
  preferred_slots?: string;
  status: AppointmentStatus;
  confirmed_start?: string;
  confirmed_end?: string;
  location?: string;
  decline_reason?: string;
  proposals?: AppointmentProposal[];
  created_at: string;
  updated_at?: string;
}

export interface AppointmentProposal {
  id: string;
  appointment_id: string;
  starts_at: string;
  ends_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string;
  data?: any;
  read_at?: string;
  created_at: string;
}

