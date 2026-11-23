export type UserRole = 'admin' | 'moderator' | 'econome' | 'teacher' | 'parent';
export type LinkStatus = 'pending' | 'approved' | 'rejected';
export type AttendanceStatus = 'present' | 'absent' | 'late';
export type FeeStatus = 'pending' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'cheque' | 'transfer' | 'other';
export type AppointmentStatus = 'pending' | 'confirmed' | 'alternatives_proposed' | 'declined' | 'cancelled';
export type ReportKind = 'official' | 'languages';
export type ReportStatus = 'draft' | 'validated' | 'published';
export type NewsCategory = 'event' | 'trip' | 'celebration' | 'info' | 'reminder';
export type AnnexServiceType = 'bus' | 'garderie' | 'etude';

export interface UserProfile {
  id: string;
  role: UserRole;
  full_name: string;
  phone?: string;
  email?: string;
  password?: string;
  locale: 'fr' | 'ar';
  active: boolean;
  avatar_url?: string;
  notifications_enabled?: boolean;
  created_at: string;
  is_super_admin?: boolean;
  invited_by_id?: string;
  /** Set by the API when an admin created the account or reset its password. */
  must_change_password?: boolean;
}

export interface StaffInvitation {
  id: string;
  email: string;
  role: Exclude<UserRole, 'parent'>;
  full_name: string;
  phone?: string;
  status: 'pending' | 'accepted' | 'expired';
  invited_by_id: string;
  invited_at: string;
  accepted_at?: string;
  expires_at?: string;
}

export interface SchoolYear {
  id: string;
  label: string; // e.g. "2026-2027"
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface Level {
  id: string;
  code: string; // prep, 1, 2, 3, 4, 5, 6
  name_fr: string;
  name_ar: string;
  position: number;
}

export interface SchoolClass {
  id: string;
  school_year_id: string;
  level_id: string;
  name: string; // e.g. "3ème A", "1ère B"
  teacher_id?: string;
  teacher_name?: string;
  teacher_ids?: string[];
  teacher_names?: string[];
  level?: Level;
  student_count?: number;
}

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  first_name_ar?: string;
  last_name_ar?: string;
  birth_date?: string;
  gender?: 'F' | 'M';
  class_id?: string;
  class_name?: string;
  level_id?: string;
  avatar?: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
}

export interface LinkRequest {
  id: string;
  parent_id: string;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
  child_first_name: string;
  child_last_name: string;
  declared_class_id?: string;
  declared_class_name?: string;
  relationship?: 'mere' | 'pere' | 'tuteur' | null;
  student_id?: string;
  status: LinkStatus;
  admin_note?: string;
  /** When the request was approved or refused. */
  reviewed_at?: string | null;
  created_at: string;
}

export interface ParentStudent {
  parent_id: string;
  student_id: string;
  relationship: string; // "père", "mère", "tuteur"
  student?: Student;
}

export interface AnnexServicePlan {
  id: string;
  type: AnnexServiceType;
  label: string;
  description: string;
  amount: number;
  active: boolean;
  created_at: string;
}

export interface ServiceEnrollment {
  id: string;
  student_id: string;
  student_name: string;
  parent_id?: string;
  service_type: AnnexServiceType;
  service_label: string;
  amount: number;
  status: 'active' | 'paused' | 'cancelled';
  start_date: string;
  end_date?: string;
  created_at: string;
}

export interface FinancialMovement {
  id: string;
  type: 'income' | 'expense';
  category: 'scolarite' | 'bus' | 'garderie' | 'etude' | 'autre';
  label: string;
  amount: number;
  student_id?: string;
  student_name?: string;
  method?: PaymentMethod;
  reference?: string;
  created_at: string;
}

export interface FinancialSummary {
  total_income: number;
  total_expense: number;
  balance: number;
  bus_income: number;
  garderie_income: number;
  etude_income: number;
}

