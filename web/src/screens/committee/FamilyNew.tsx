import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api';

interface NewStudent {
  name: string;
  level: string;
  grade: string;
}

export default function FamilyNew() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [parentNames, setParentNames] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [students, setStudents] = useState<NewStudent[]>([{ name: '', level: 'primaria', grade: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateStudent = (index: number, field: keyof NewStudent, value: string) => {
    setStudents((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const addStudentRow = () => {
    setStudents((prev) => [...prev, { name: '', level: 'primaria', grade: '' }]);
  };

  const removeStudentRow = (index: number) => {
    setStudents((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError('');
    try {
      const family = await api.createFamily({
        name: name.trim(),
        parent_names: parentNames.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });

      for (const s of students) {
        if (s.name.trim() && s.grade.trim()) {
          await api.createStudent(family.id, {
            name: s.name.trim(),
            level: s.level,
            grade: s.grade.trim(),
          });
        }
      }

      navigate(`/familias/${family.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear familia');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/familias" className="text-sm text-gray-500 hover:text-gray-700">← Familias</Link>
      </div>

      <h1 className="text-xl font-semibold text-gray-900">Nueva familia</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre familia *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required
                placeholder="Ej: Gonzalez - Tozzini"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Padres</label>
              <input value={parentNames} onChange={(e) => setParentNames(e.target.value)}
                placeholder="Ej: Nicolas y Graciana"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900">Hijos</h2>
            <button type="button" onClick={addStudentRow}
              className="text-xs text-gray-500 hover:text-gray-700">+ Agregar hijo</button>
          </div>
          <div className="p-4 space-y-3">
            {students.map((s, i) => (
              <div key={i} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                  <input value={s.name} onChange={(e) => updateStudent(i, 'name', e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nivel</label>
                  <select value={s.level} onChange={(e) => updateStudent(i, 'level', e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                    <option value="jardin">Jardín</option>
                    <option value="primaria">Primaria</option>
                    <option value="secundaria">Secundaria</option>
                    <option value="12vo">12vo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Grado</label>
                  <input value={s.grade} onChange={(e) => updateStudent(i, 'grade', e.target.value)}
                    placeholder="Ej: EP3"
                    className="w-28 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                {students.length > 1 && (
                  <button type="button" onClick={() => removeStudentRow(i)}
                    className="text-xs text-red-400 hover:text-red-600 pb-2">Quitar</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={saving || !name.trim()}
            className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
            {saving ? 'Creando...' : 'Crear familia'}
          </button>
          <Link to="/familias"
            className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
