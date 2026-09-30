import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createProject, listProjects } from '../api.js';

export default function ProjectList() {
  const [projects, setProjects] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listProjects().then(setProjects).catch((e) => setLoadError(e.message));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setErrors({ name: 'Projekti nimi on kohustuslik.' });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const created = await createProject({ name, description });
      setProjects((list) => [created, ...(list ?? [])]);
      setName('');
      setDescription('');
    } catch (err) {
      setErrors({ [err.field || 'form']: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <section className="card">
        <h2>Uus projekt</h2>
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="name">Nimi</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
          {errors.name && <p id="name-error" className="error">{errors.name}</p>}

          <label htmlFor="description">Lühikirjeldus</label>
          <textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          {errors.description && <p className="error">{errors.description}</p>}

          {errors.form && <p className="error">{errors.form}</p>}
          <button type="submit" disabled={saving}>{saving ? 'Salvestan…' : 'Loo projekt'}</button>
        </form>
      </section>

      <section>
        <h2>Projektid</h2>
        {loadError && <p className="error">Projekte ei saanud laadida: {loadError}</p>}
        {!loadError && projects === null && <p className="muted">Laadin…</p>}
        {projects?.length === 0 && <p className="muted">Projekte veel ei ole.</p>}
        {projects?.length > 0 && (
          <ul className="project-list">
            {projects.map((p) => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`}>{p.name}</Link>
                {p.description && <p className="muted">{p.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
