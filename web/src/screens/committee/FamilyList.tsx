import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import type { Agreement, Family, Student } from '../../types';
import FamilyFilters from '../../components/FamilyFilters';
import { formatMonthYear, localDateKey } from '../../utils/format';

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  solicitud: { label: 'Solicitud', className: 'bg-purple-50 text-purple-700' },
  formulario_enviado: { label: 'Form. enviado', className: 'bg-violet-50 text-violet-700' },
  formulario_completado: { label: 'Form. completado', className: 'bg-indigo-50 text-indigo-700' },
  agendado: { label: 'Entrevista', className: 'bg-blue-50 text-blue-700' },
  en_definicion: { label: 'En definición', className: 'bg-amber-50 text-amber-700' },
  otorgado: { label: 'Otorgado', className: 'bg-green-50 text-green-700' },
  rechazado: { label: 'Rechazado', className: 'bg-red-50 text-red-700' },
  suspendido: { label: 'Vencido', className: 'bg-gray-100 text-gray-500' },
};

const PDF_STATUS_CLASSES: Record<string, string> = {
  solicitud: 'status-solicitud',
  formulario_enviado: 'status-formulario-enviado',
  formulario_completado: 'status-formulario-completado',
  agendado: 'status-agendado',
  en_definicion: 'status-en-definicion',
  otorgado: 'status-otorgado',
  rechazado: 'status-rechazado',
  suspendido: 'status-suspendido',
};

const STATUS_ORDER: Record<string, number> = {
  solicitud: 0,
  formulario_enviado: 1,
  formulario_completado: 2,
  agendado: 3,
  en_definicion: 4,
  otorgado: 5,
  rechazado: 6,
  suspendido: 7,
};

function formatInterviewShort(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (isToday) return `Hoy ${time}`;
  if (isTomorrow) return `Mañana ${time}`;
  return `${d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })} ${time}`;
}

type SortKey = 'name' | 'student_count' | 'status' | 'discount' | 'total_discount' | 'interview';
type SortDir = 'asc' | 'desc';

function SortHeader({ label, sortKey, current, direction, onSort, align }: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  direction: SortDir;
  onSort: (key: SortKey) => void;
  align?: 'right';
}) {
  const active = current === sortKey;
  return (
    <th
      className={`px-4 py-3 font-medium cursor-pointer select-none hover:text-gray-900 transition-colors ${align === 'right' ? 'text-right' : ''}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {align === 'right' && active && (
          <span className="text-gray-400">{direction === 'asc' ? '↑' : '↓'}</span>
        )}
        {label}
        {align !== 'right' && active && (
          <span className="text-gray-400">{direction === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );
}

export default function FamilyList() {
  const { user, can } = useAuth();
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'familia' | 'docente'>('todos');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(
    new Set(['solicitud', 'formulario_enviado', 'formulario_completado', 'agendado', 'en_definicion'])
  );
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    api.getFamilies().then(setFamilies).finally(() => setLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'discount' || key === 'total_discount' ? 'desc' : 'asc');
    }
  };

  const exportFilteredFamilies = async () => {
    if (filtered.length === 0 || exporting) return;
    setExporting(true);
    try {
      const [familyDetails, agreements] = await Promise.all([
        Promise.all(filtered.map((family) => api.getFamily(family.id))),
        api.getAgreements(),
      ]);
      const agreementsByFamilyId = new Map<number, Agreement>(
        agreements.map((agreement) => [agreement.family_id, agreement])
      );

      const studentCount = familyDetails.reduce((sum, family) => sum + family.students.length, 0);
      const totalAid = familyDetails.reduce((sum, family) => {
        const agreement = agreementsByFamilyId.get(family.id);
        return sum + (agreement?.students ?? []).reduce(
          (familySum, student) => familySum + Number(student.discount_amount ?? 0),
          0
        );
      }, 0);
      const totalToPay = familyDetails.reduce((sum, family) => {
        const agreement = agreementsByFamilyId.get(family.id);
        return sum + (agreement?.students ?? []).reduce(
          (familySum, student) => familySum + Number(student.amount_to_pay ?? 0),
          0
        );
      }, 0);
      const generatedAt = new Date().toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      const fileDate = localDateKey();
      const reportTitle = `Reporte de Acuerdos Economicos - ${fileDate}`;

      const rowsHtml = familyDetails.map((family) => {
        const summary = filtered.find((f) => f.id === family.id) ?? family;
        const agreement = agreementsByFamilyId.get(family.id);
        const familyAmountToPay = (agreement?.students ?? []).reduce(
          (sum, student) => sum + Number(student.amount_to_pay ?? 0),
          0
        );
        const students = family.students.length > 0 ? family.students : [{
          id: 0,
          family_id: family.id,
          name: 'Sin estudiantes',
          level: 'primaria',
          grade: '—',
          file_number: null,
        } satisfies Student];
        const agreementStudents = new Map(
          (agreement?.students ?? []).map((student) => [student.student_id, student])
        );
        const familyStatus = STATUS_LABELS[family.status]?.label ?? family.status;
        const familyStatusClass = PDF_STATUS_CLASSES[family.status] ?? 'status-default';
        const familyType = (family.family_type ?? 'familia') === 'docente' ? 'Docente' : 'Familia';
        const periodLabel = agreement?.impact_starts_at || agreement?.expires_at
          ? `${agreement.impact_starts_at
            ? formatMonthYear(agreement.impact_starts_at, 'short')
            : 'Actual'} - ${agreement.expires_at
            ? formatMonthYear(agreement.expires_at, 'short')
            : 'Actual'}`
          : 'Actual';
        const observations = family.notes?.trim();

        const studentRows = students.map((student, index) => {
          const agreementStudent = agreementStudents.get(student.id);
          const discountPercentage = agreementStudent?.discount_percentage ?? agreement?.discount_percentage;
          return `
            <tr>
              ${index === 0 ? `
                <td class="family-cell" rowspan="${students.length}">
                  <strong>${escapeHtml(family.name)}</strong>
                  ${family.parent_names ? `<span>${escapeHtml(family.parent_names)}</span>` : ''}
                  ${family.email ? `<small>${escapeHtml(family.email)}</small>` : ''}
                </td>
                <td class="type-cell" rowspan="${students.length}">${familyType}</td>
              ` : ''}
              <td>${escapeHtml(student.name)}</td>
              <td>${escapeHtml(student.grade || '—')}</td>
              <td><span class="status-pill ${familyStatusClass}">${escapeHtml(familyStatus)}</span></td>
              <td>${escapeHtml(periodLabel)}</td>
              <td class="money">${agreementStudent ? formatMoney(agreementStudent.base_tuition) : '—'}</td>
              <td class="percent">${discountPercentage != null ? `${Number(discountPercentage).toFixed(0)}%` : '—'}</td>
              <td class="money aid">${agreementStudent ? formatMoney(agreementStudent.discount_amount) : '—'}</td>
              ${index === 0 ? `
                <td class="money family-total" rowspan="${students.length}">${agreement ? formatMoney(familyAmountToPay) : summary.total_to_pay != null ? formatMoney(summary.total_to_pay) : '—'}</td>
                <td class="notes-cell" rowspan="${students.length}">${observations ? escapeHtml(observations) : '—'}</td>
              ` : ''}
            </tr>
          `;
        }).join('');

        return studentRows;
      }).join('');

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(`<!doctype html>
        <html lang="es">
          <head>
            <meta charset="utf-8" />
            <title>${reportTitle}</title>
            <style>
              @page { size: A4 landscape; margin: 7mm; }
              * { box-sizing: border-box; }
              body {
                margin: 0;
                color: #111827;
                background: #f8fafc;
                font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              }
              .page { padding: 10px; }
              .hero {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 16px;
                padding: 12px 14px;
                border: 1px solid #e5e7eb;
                border-radius: 14px;
                background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 55%, #eff6ff 100%);
                margin-bottom: 8px;
              }
              h1 { margin: 0; font-size: 18px; letter-spacing: -0.03em; }
              .subtitle { margin-top: 3px; color: #6b7280; font-size: 10px; }
              .stats {
                display: grid;
                grid-template-columns: repeat(4, minmax(110px, 1fr));
                gap: 6px;
                min-width: 520px;
              }
              .stat {
                background: rgba(255,255,255,0.72);
                border: 1px solid rgba(229,231,235,0.9);
                border-radius: 10px;
                padding: 6px 8px;
              }
              .stat span { display: block; color: #6b7280; font-size: 8px; text-transform: uppercase; letter-spacing: .06em; }
              .stat strong { display: block; margin-top: 2px; font-size: 13px; }
              table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 12px;
                overflow: hidden;
              }
              th {
                background: #f9fafb;
                color: #6b7280;
                font-size: 7px;
                text-transform: uppercase;
                letter-spacing: .06em;
                padding: 5px 4px;
                text-align: left;
                border-bottom: 1px solid #e5e7eb;
              }
              td {
                font-size: 8px;
                padding: 4px;
                border-bottom: 1px solid #f1f5f9;
                vertical-align: top;
                line-height: 1.22;
              }
              tr:last-child td { border-bottom: 0; }
              .family-cell {
                width: 130px;
                background: #fcfcfd;
                border-right: 1px solid #f1f5f9;
              }
              .family-cell strong { display: block; font-size: 9px; }
              .family-cell span, .family-cell small {
                display: block;
                margin-top: 1px;
                color: #6b7280;
                line-height: 1.35;
              }
              .type-cell { width: 52px; color: #0369a1; font-weight: 700; }
              .status-pill {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 999px;
                font-size: 7px;
                line-height: 1.2;
                font-weight: 700;
                white-space: nowrap;
              }
              .status-solicitud { background: #faf5ff; color: #7e22ce; }
              .status-formulario-enviado { background: #f5f3ff; color: #6d28d9; }
              .status-formulario-completado { background: #eef2ff; color: #4338ca; }
              .status-agendado { background: #eff6ff; color: #1d4ed8; }
              .status-en-definicion { background: #fffbeb; color: #b45309; }
              .status-otorgado { background: #f0fdf4; color: #15803d; }
              .status-rechazado { background: #fef2f2; color: #b91c1c; }
              .status-suspendido { background: #f3f4f6; color: #6b7280; }
              .status-default { background: #f3f4f6; color: #374151; }
              .money, .percent { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
              .aid { color: #047857; font-weight: 700; }
              .family-total { background: #f0fdf4; color: #065f46; font-weight: 800; }
              .notes-cell {
                width: 165px;
                color: #4b5563;
                max-width: 165px;
              }
              .footer {
                margin-top: 6px;
                color: #9ca3af;
                font-size: 8px;
                text-align: right;
              }
              @media print {
                body { background: white; }
                .page { padding: 0; }
                .hero { break-inside: avoid; }
                tr { break-inside: avoid; page-break-inside: avoid; }
              }
            </style>
          </head>
          <body>
            <main class="page">
              <section class="hero">
                <div>
                  <h1>Listado actual de familias</h1>
                  <p class="subtitle">Exportado el ${generatedAt} por ${escapeHtml(user?.name ?? user?.email ?? 'Usuario')}</p>
                </div>
                <div class="stats">
                  <div class="stat"><span>Familias</span><strong>${filtered.length}</strong></div>
                  <div class="stat"><span>Estudiantes</span><strong>${studentCount}</strong></div>
                  <div class="stat"><span>Ayuda mensual</span><strong>${formatMoney(totalAid)}</strong></div>
                  <div class="stat"><span>Total a pagar</span><strong>${formatMoney(totalToPay)}</strong></div>
                </div>
              </section>
              <table>
                <thead>
                  <tr>
                    <th>Familia</th>
                    <th>Tipo</th>
                    <th>Estudiante</th>
                    <th>Curso</th>
                    <th>Estado</th>
                    <th>Período</th>
                    <th class="money">Cuota pura</th>
                    <th class="money">%</th>
                    <th class="money">Ayuda económica</th>
                    <th class="money">Total Familia</th>
                    <th>Observaciones generales</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
              <p class="footer">Acuerdos Económicos · reporte generado desde la sección Familias</p>
            </main>
            <script>
              window.addEventListener('load', () => {
                window.print();
              });
            </script>
          </body>
        </html>`);
      printWindow.document.close();
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>;

  const filtered = families
    .filter((f) => {
      const matchesName = !filter || f.name.toLowerCase().includes(filter.toLowerCase());
      const matchesType = typeFilter === 'todos' || (f.family_type ?? 'familia') === typeFilter;
      const matchesStatus = statusFilter.size === 0 || statusFilter.has(f.status);
      return matchesName && matchesType && matchesStatus;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'student_count':
          return ((a.student_count ?? 0) - (b.student_count ?? 0)) * dir;
        case 'status': {
          const sa = STATUS_ORDER[a.status] ?? 9;
          const sb = STATUS_ORDER[b.status] ?? 9;
          if (sa !== sb) return (sa - sb) * dir;
          return a.name.localeCompare(b.name);
        }
        case 'discount':
          return (Number(a.discount_percentage ?? 0) - Number(b.discount_percentage ?? 0)) * dir;
        case 'total_discount':
          return (Number(a.total_discount ?? 0) - Number(b.total_discount ?? 0)) * dir;
        case 'interview': {
          const da = a.interview_date ? new Date(a.interview_date).getTime() : 0;
          const db = b.interview_date ? new Date(b.interview_date).getTime() : 0;
          return (da - db) * dir;
        }
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Familias</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportFilteredFamilies}
            disabled={exporting || filtered.length === 0}
            className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {exporting ? 'Exportando...' : 'Exportar PDF'}
          </button>
          {can('canManageFamilies') && (
            <Link to="/familias/nueva"
              className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
              + Nueva familia
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <FamilyFilters
            search={filter}
            onSearchChange={setFilter}
            resultCount={filtered.length}
            statusLabels={STATUS_LABELS}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
          />
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <SortHeader label="Familia" sortKey="name" current={sortKey} direction={sortDir} onSort={handleSort} />
              <SortHeader label="Hijos" sortKey="student_count" current={sortKey} direction={sortDir} onSort={handleSort} />
              <SortHeader label="Estado" sortKey="status" current={sortKey} direction={sortDir} onSort={handleSort} />
              <SortHeader label="Entrevista" sortKey="interview" current={sortKey} direction={sortDir} onSort={handleSort} />
              <SortHeader label="% Descuento" sortKey="discount" current={sortKey} direction={sortDir} onSort={handleSort} align="right" />
              <SortHeader label="Descuento mensual" sortKey="total_discount" current={sortKey} direction={sortDir} onSort={handleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  No se encontraron familias
                </td>
              </tr>
            ) : (
              filtered.map((family) => {
                const status = STATUS_LABELS[family.status] ?? STATUS_LABELS.solicitud;
                return (
                  <tr key={family.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link to={`/familias/${family.id}`} className="text-sm font-medium text-gray-900 hover:underline">
                          {family.name}
                        </Link>
                        {(family.family_type ?? 'familia') === 'docente' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-sky-50 text-sky-600">
                            Docente
                          </span>
                        )}
                      </div>
                      {family.parent_names && (
                        <p className="text-xs text-gray-400">{family.parent_names}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{family.student_count ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {family.interview_date ? formatInterviewShort(family.interview_date) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {family.discount_percentage ? `${Number(family.discount_percentage).toFixed(0)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                      {family.total_discount ? formatMoney(family.total_discount) : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
