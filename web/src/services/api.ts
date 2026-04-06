const API_BASE = '/api';

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

  createFamily: (data: { name: string; parent_names?: string; email?: string; phone?: string }) =>
    request<import('../types').Family>('/families', { method: 'POST', body: JSON.stringify(data) }),

  updateFamily: (id: number, data: Partial<import('../types').Family>) =>
    request<import('../types').Family>(`/families/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Estudiantes
  getStudents: (familyId: number) =>
    request<import('../types').Student[]>(`/families/${familyId}/students`),

  createStudent: (familyId: number, data: { name: string; level: string; grade: string; file_number?: string }) =>
    request<import('../types').Student>(`/families/${familyId}/students`, { method: 'POST', body: JSON.stringify(data) }),

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
    status?: string;
  }) =>
    request<import('../types').Agreement>('/agreements', { method: 'POST', body: JSON.stringify(data) }),

  updateAgreement: (id: number, data: Partial<import('../types').Agreement>) =>
    request<import('../types').Agreement>(`/agreements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteAgreement: (id: number) =>
    request<{ ok: boolean }>(`/agreements/${id}`, { method: 'DELETE' }),

  updateAgreementStatus: (id: number, status: string) =>
    request<import('../types').Agreement>(`/agreements/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Presupuesto
  getBudgetSummary: (periodId?: number) =>
    request<import('../types').BudgetSummary>(`/budget/summary${periodId ? `?period_id=${periodId}` : ''}`),

  // Comentarios
  getComments: (agreementId: number) =>
    request<import('../types').Comment[]>(`/agreements/${agreementId}/comments`),

  addComment: (agreementId: number, content: string) =>
    request<import('../types').Comment>(`/agreements/${agreementId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};
