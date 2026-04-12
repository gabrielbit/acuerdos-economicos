export interface UserPermissions {
  canManageFamilies: boolean;
  canManageAgreements: boolean;
  canChangeStatus: boolean;
  canManageUsers: boolean;
  canComment: boolean;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'committee' | 'family';
  familyId: number | null;
  permissions: UserPermissions;
}

export type FamilyStatus =
  | 'solicitud'
  | 'formulario_enviado'
  | 'formulario_completado'
  | 'agendado'
  | 'en_definicion'
  | 'otorgado'
  | 'rechazado'
  | 'suspendido';

export interface Family {
  id: number;
  name: string;
  parent_names: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  locality: string | null;
  postal_code: string | null;
  user_id: number | null;
  created_at: string;
  status: FamilyStatus;
  student_count?: number;
  discount_percentage?: number;
  total_tuition?: number;
  total_to_pay?: number;
  total_discount?: number;
}

export interface Student {
  id: number;
  family_id: number;
  name: string;
  level: 'jardin' | 'primaria' | 'secundaria' | '12vo';
  grade: string;
  file_number: string | null;
}

export interface AidPeriod {
  id: number;
  name: string;
  start_month: number;
  end_month: number;
  year: number;
  total_budget: number;
  is_active: boolean;
}

export interface TuitionRate {
  id: number;
  period_id: number;
  level: string;
  tuition_amount: number;
  extras_amount: number;
}

export interface Agreement {
  id: number;
  family_id: number;
  period_id: number;
  discount_percentage: number;
  observations: string | null;
  approved_by: number | null;
  created_at: string;
  updated_at: string;
  granted_at: string | null;
  students?: AgreementStudent[];
  family?: Family;
}

export interface AgreementStudent {
  id: number;
  agreement_id: number;
  student_id: number;
  student_name?: string;
  level: string;
  base_tuition: number;
  extras: number;
  discount_percentage: number;
  discount_amount: number;
  amount_to_pay: number;
}

export interface Comment {
  id: number;
  entity_type: 'family' | 'agreement';
  entity_id: number;
  user_id: number;
  user_name: string;
  content: string;
  created_at: string;
}

export interface AidRequest {
  id: number;
  family_id: number;
  period_id: number;
  status: 'borrador' | 'enviada' | 'en_revision' | 'resuelta';
  requested_discount: number | null;
  is_renewal: boolean;
  reason: string | null;
  housing_type: string | null;
  housing_surface: string | null;
  housing_rooms: number | null;
  housing_bedrooms: number | null;
  additional_info: Record<string, unknown> | null;
  form_snapshot: Record<string, unknown> | null;
  submitted_by: number | null;
  submitted_by_name?: string;
  submitted_at: string | null;
  family_name?: string;
  period_name?: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetSummary {
  total_budget: number;
  total_granted: number;
  granted_assigned: number;
  granted_in_definition: number;
  available: number;
  assigned_percentage: number;
  in_definition_percentage: number;
  available_percentage: number;
  total_families: number;
  families_assigned: number;
  families_in_definition: number;
  families_pending: number;
}
