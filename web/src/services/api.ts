const API_BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Error de servidor' }));
    throw new Error(body.error ?? `Error ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: import('../types').User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => request<import('../types').User>('/auth/me'),

  // Familias
  getFamilies: (periodId?: number) =>
    request<import('../types').Family[]>(`/families${periodId ? `?period_id=${periodId}` : ''}`),

  getFamily: (id: number) =>
    request<import('../types').Family & { students: import('../types').Student[] }>(`/families/${id}`),

  createFamily: (data: { name: string; parent_names?: string; email?: string; phone?: string; family_type?: string }) =>
    request<import('../types').Family>('/families', { method: 'POST', body: JSON.stringify(data) }),

  updateFamily: (id: number, data: Partial<import('../types').Family>) =>
    request<import('../types').Family>(`/families/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  updateFamilyStatus: (id: number, status: string, interview_date?: string | null) =>
    request<import('../types').Family>(`/families/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...(interview_date !== undefined ? { interview_date } : {}) }),
    }),

  updateInterviewDate: (id: number, interview_date: string | null) =>
    request<import('../types').Family>(`/families/${id}/interview`, {
      method: 'PATCH',
      body: JSON.stringify({ interview_date }),
    }),

  getUpcomingInterviews: () =>
    request<Array<{ id: number; name: string; parent_names: string | null; interview_date: string; status: string }>>('/families/interviews'),

  // Estudiantes
  getStudents: (familyId: number) =>
    request<import('../types').Student[]>(`/families/${familyId}/students`),

  createStudent: (familyId: number, data: { name: string; level: string; grade: string; file_number?: string }) =>
    request<import('../types').Student>(`/families/${familyId}/students`, { method: 'POST', body: JSON.stringify(data) }),
  updateStudent: (familyId: number, studentId: number, data: Partial<{ name: string; level: string; grade: string; file_number: string }>) =>
    request<import('../types').Student>(`/families/${familyId}/students/${studentId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStudent: (familyId: number, studentId: number) =>
    request<{ ok: boolean }>(`/families/${familyId}/students/${studentId}`, { method: 'DELETE' }),

  // Períodos
  getPeriods: () => request<import('../types').AidPeriod[]>('/periods'),
  getActivePeriod: () => request<import('../types').AidPeriod>('/periods/active'),
  createPeriod: (data: { name: string; start_month: number; end_month: number; year: number; total_budget: number }) =>
    request<import('../types').AidPeriod>('/periods', { method: 'POST', body: JSON.stringify(data) }),

  // Cuotas
  getTuitionRates: (periodId: number) =>
    request<import('../types').TuitionRate[]>(`/tuition-rates?period_id=${periodId}`),

  createTuitionRate: (data: { period_id: number; level: string; tuition_amount: number; extras_amount: number }) =>
    request<import('../types').TuitionRate>('/tuition-rates', { method: 'POST', body: JSON.stringify(data) }),

  // Acuerdos
  getAgreements: (periodId?: number) =>
    request<import('../types').Agreement[]>(`/agreements${periodId ? `?period_id=${periodId}` : ''}`),

  getAgreement: (id: number) =>
    request<import('../types').Agreement>(`/agreements/${id}`),

  createAgreement: (data: {
    family_id: number;
    period_id: number;
    discount_percentage: number;
    observations?: string;
    impact_starts_at?: string;
    expires_at?: string;
    discount_effective_from?: string;
    status?: string;
  }) =>
    request<import('../types').Agreement>('/agreements', { method: 'POST', body: JSON.stringify(data) }),

  updateAgreement: (id: number, data: Partial<import('../types').Agreement>) =>
    request<import('../types').Agreement>(`/agreements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteAgreement: (id: number) =>
    request<{ ok: boolean }>(`/agreements/${id}`, { method: 'DELETE' }),


  // Presupuesto
  getBudgetSummary: (periodId?: number) =>
    request<import('../types').BudgetSummary>(`/budget/summary${periodId ? `?period_id=${periodId}` : ''}`),
  getBudgetHistory: (months = 12) =>
    request<import('../types').BudgetHistoryEntry[]>(`/budget/history?months=${months}`),
  getBudgetProjection: () =>
    request<import('../types').BudgetProjectionEntry[]>('/budget/projection'),

  // Configuración editable
  getSetting: (key: string) =>
    request<{ key: string; value: string; updated_at: string; updated_by: number | null }>(`/settings/${key}`),
  updateSetting: (key: string, value: string) =>
    request<{ key: string; value: string; updated_at: string; updated_by: number | null }>(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),

  // Comentarios (polimórficos)
  getComments: (entityType: 'family' | 'agreement', entityId: number) =>
    request<import('../types').Comment[]>(`/comments?entity_type=${entityType}&entity_id=${entityId}`),

  getRecentComments: () =>
    request<Array<{
      id: number; content: string; user_name: string; created_at: string;
      entity_type: string; family_name: string | null; family_id: number | null;
    }>>('/comments/recent'),

  addComment: (entityType: 'family' | 'agreement', entityId: number, content: string) =>
    request<import('../types').Comment>(`/comments?entity_type=${entityType}&entity_id=${entityId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  // Usuarios
  getUsers: () => request<Record<string, unknown>[]>('/users'),

  createUser: (data: { email: string; name: string; password: string; can_manage_families?: boolean; can_manage_agreements?: boolean; can_change_status?: boolean; can_manage_users?: boolean; can_comment?: boolean }) =>
    request<Record<string, unknown>>('/users', { method: 'POST', body: JSON.stringify(data) }),

  updateUser: (id: number, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteUser: (id: number) =>
    request<{ ok: boolean }>(`/users/${id}`, { method: 'DELETE' }),

  // Invitaciones
  createInvitation: (familyId: number) =>
    request<Record<string, unknown>>(`/families/${familyId}/invitation`, { method: 'POST', body: '{}' }),

  getInvitation: (familyId: number) =>
    request<Record<string, unknown> | null>(`/families/${familyId}/invitation`),

  validateInvitation: (token: string) =>
    request<{ family_name: string; family_id: number; valid: boolean }>(`/invitations/${token}`),

  registerFromInvitation: (token: string, data: { name: string; email: string; password: string }) =>
    request<{ token: string; user: import('../types').User }>(`/invitations/${token}/register`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Portal familia
  getPortalFamily: () => request<import('../types').Family & { students: import('../types').Student[] }>('/portal/family'),
  getPortalAgreements: () => request<import('../types').Agreement[]>('/portal/agreements'),
  getPortalRequest: () => request<import('../types').AidRequest | null>('/portal/request'),
  submitPortalRequest: (data: Record<string, unknown>) =>
    request<import('../types').AidRequest>('/portal/request', { method: 'POST', body: JSON.stringify(data) }),

  // Tarifarios
  getFeeSchedules: () =>
    request<import('../types').FeeSchedule[]>('/fee-schedules'),

  getActiveFeeSchedule: () =>
    request<import('../types').FeeSchedule>('/fee-schedules/active'),

  createFeeSchedule: (data: {
    name: string;
    effective_from: string;
    total_budget: number;
    rates: Array<{ level: string; tuition_amount: number; extras_amount: number }>;
  }) =>
    request<import('../types').FeeSchedule>('/fee-schedules', { method: 'POST', body: JSON.stringify(data) }),

  // Ahorro mensual
  getMonthlySavings: (familyId: number, from?: string, to?: string) =>
    request<import('../types').MonthlySavingsEntry[]>(
      `/families/${familyId}/monthly-savings${from && to ? `?from=${from}&to=${to}` : ''}`
    ),

  // Solicitudes (comisión)
  getRequests: () => request<import('../types').AidRequest[]>('/requests'),
  getRequest: (id: number) => request<import('../types').AidRequest>(`/requests/${id}`),
  deleteRequest: (id: number) => request<{ ok: boolean }>(`/requests/${id}`, { method: 'DELETE' }),
};
