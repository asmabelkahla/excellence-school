import { FeeStatus, PaymentMethod } from './school.model';

export type { PaymentMethod } from './school.model';

export type PaymentType =
  | 'mensualite'
  | 'inscription'
  | 'club'
  | 'garde'
  | 'transport'
  | 'etude_supplementaire';

export interface Fee {
  id: string;
  student_id: string;
  student_name?: string;
  student_first_name?: string;
  student_last_name?: string;
  class_id?: string;
  class_name?: string;
  school_year_id: string;
  label: string; // "Scolarité T1", "Cantine - Octobre", "Transport", "Inscription"
  amount: number; // in TND, e.g. 350.000
  due_date: string; // YYYY-MM-DD
  status: FeeStatus; // 'pending' | 'paid' | 'cancelled'
  payment_type?: PaymentType;
  paid_amount?: number;
  paid_at?: string;
  method?: PaymentMethod;
  reference?: string; // Cheque number or bank transfer ref
  note?: string;
  receipt_path?: string;
  recorded_by?: string;
  recorded_by_name?: string;
  created_at: string;
  updated_at?: string;
  // Computed
  is_overdue?: boolean;
}

export interface PaymentReceipt {
  receipt_number: string;
  date: string;
  student_name: string;
  class_name: string;
  parent_name: string;
  fee_label: string;
  amount: number;
  payment_method: PaymentMethod;
  reference?: string;
  recorded_by: string;
  school_name: string;
}

export interface FeeStatistics {
  total_expected: number;
  total_collected: number;
  total_pending: number;
  total_overdue: number;
  count_paid: number;
  count_pending: number;
  count_overdue: number;
}

