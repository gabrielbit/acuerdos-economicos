import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';

const DEFAULT_SCRIPT = `<h2>Bienvenida</h2>
<p>Somos la Comisión de Acuerdos Económicos del colegio.</p>
<p>Nuestro objetivo es acompañar a las familias para que cada estudiante pueda continuar su trayectoria educativa.</p>
<ul>
  <li>Escuchamos cada situación con respeto y confidencialidad.</li>
  <li>Evaluamos cada caso de manera personalizada.</li>
  <li>Buscamos acuerdos sostenibles para la familia y para el colegio.</li>
</ul>`;

export default function Script() {
  const editorRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(DEFAULT_SCRIPT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    api.getSetting('welcome_script')
      .then((setting) => {
        setContent(setting.value || DEFAULT_SCRIPT);
        setSavedAt(setting.updated_at);
      })
      .catch(() => {
        setContent(DEFAULT_SCRIPT);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content;
    }
  }, [content]);

  const runCommand = (command: string) => {
    document.execCommand(command);
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
    }
  };

  const save = async () => {
    if (!editorRef.current) return;
    setSaving(true);
    try {
      const html = editorRef.current.innerHTML.trim() || '<p></p>';
      const result = await api.updateSetting('welcome_script', html);
      setContent(result.value);
      setSavedAt(result.updated_at);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Script para familias</h1>
          <p className="text-sm text-gray-500">Texto editable que usa la comisión para explicar el proceso.</p>
          {savedAt && (
            <p className="text-xs text-gray-400 mt-1">
              Ultima actualizacion: {new Date(savedAt).toLocaleString('es-AR')}
            </p>
          )}
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 flex gap-2">
          <button onClick={() => runCommand('bold')} className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50">Negrita</button>
          <button onClick={() => runCommand('italic')} className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50">Cursiva</button>
          <button onClick={() => runCommand('insertUnorderedList')} className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50">Lista</button>
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => setContent(editorRef.current?.innerHTML ?? '')}
          className="min-h-[320px] p-4 prose max-w-none focus:outline-none"
        />
      </div>
    </div>
  );
}
