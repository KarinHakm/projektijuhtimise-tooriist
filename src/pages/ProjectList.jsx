import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createProject, listProjects } from '../api.js';
import DemoTag from '../components/DemoTag.jsx';
import { MARKS, STATUS_LABELS } from '../components/StagePanel.jsx';
import { splitDemoName } from '../demo/name.js';

// Kaardi etapiseis tekstina (sama sisu on täppidena, mis on ainult visuaalsed).
export function progressText(progress) {
  if (!progress) return '';
  const parts = [progress.lastDone ? `Viimati läbitud: ${progress.lastDone}` : 'Alustamata'];
  if (progress.nextStep) parts.push(`Järgmine samm: ${progress.nextStep}`);
  return parts.join(' · ');
}

const dateEt = (iso) => new Date(iso).toLocaleDateString('et-EE');

// Avaleht: pealkiri, selgitus, "+ Loo projekt" ja projektikaardid (L03).
// Terve kaart on üks link; "Ava →" on selle sees ainult visuaalne tekst.
export function ProjectListView({ projects, loadError = '', formOpen = false, form = null, onOpenForm }) {
  return (
    <main className="home">
      <div className="home__intro">
        <div>
          <h1 className="home__title">Projektid</h1>
          <p className="home__lead">
            Kirjelda kliendi idee – AI aitab sellest teha rollid, kasutajalood, vastuvõtukriteeriumid ja mockup'i. Otsused teed sina.
          </p>
        </div>
        {!formOpen && (
          <button type="button" className="home__create" aria-expanded="false" aria-controls="uus-projekt" onClick={onOpenForm}>+ Loo projekt</button>
        )}
      </div>

      {formOpen && form}

      <section aria-labelledby="projektid-loend">
        <h2 id="projektid-loend" className="visually-hidden">Projektide loend</h2>
        {loadError && <p className="error">Projekte ei saanud laadida: {loadError}</p>}
        {!loadError && projects === null && <p className="muted">Laadin…</p>}
        {projects?.length === 0 && (
          <div className="empty-state">
            <p className="empty-state__title">Projekte veel ei ole.</p>
            <p className="muted">Alusta kliendi ideest – AI esitab täpsustavad küsimused ja pakub seejärel rolle ja lugusid.</p>
            {!formOpen && <button type="button" aria-controls="uus-projekt" onClick={onOpenForm}>+ Loo esimene projekt</button>}
          </div>
        )}
        {projects?.length > 0 && (
          <ul className="project-cards">
            {projects.map((p) => {
              const { demo, name } = splitDemoName(p.name);
              return (
                <li key={p.id}>
                  <Link to={`/projects/${p.id}`} className="project-card">
                    <span className="project-card__head">
                      <span className="project-card__name">{name}{demo && <DemoTag />}</span>
                      <span className="project-card__open" aria-hidden="true">Ava →</span>
                    </span>
                    {p.description && <span className="project-card__desc">{p.description}</span>}
                    {p.progress && (
                      <span className="project-card__progress">
                        <span className="stage-dots" aria-hidden="true">
                          {p.progress.stages.map((s) => (
                            <span key={s.key} className={`stage-dot stage-dot--${s.status}`} title={`${s.label}: ${STATUS_LABELS[s.status]}`}>{MARKS[s.status]}</span>
                          ))}
                        </span>
                        <span className="project-card__stage">{progressText(p.progress)}</span>
                      </span>
                    )}
                    <span className="project-card__meta">
                      {p.progress ? `${p.progress.storyCount} lugu · ` : ''}Loodud {dateEt(p.createdAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

export default function ProjectList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    listProjects().then(setProjects).catch((e) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    if (formOpen) nameRef.current?.focus();
  }, [formOpen]);

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
      navigate(`/projects/${created.id}`); // loodud projekt avaneb kohe; järgmine samm on idee kirjeldamine
    } catch (err) {
      setErrors({ [err.field || 'form']: err.message });
      setSaving(false);
    }
  }

  function closeForm() {
    setFormOpen(false);
    setName('');
    setDescription('');
    setErrors({});
  }

  const form = (
    <section className="card new-project" id="uus-projekt" aria-labelledby="uus-projekt-pealkiri">
      <h2 id="uus-projekt-pealkiri">Uus projekt</h2>
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="name">Nimi</label>
        <input
          id="name"
          ref={nameRef}
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
        <div className="actions">
          <button type="submit" disabled={saving}>{saving ? 'Salvestan…' : 'Loo projekt'}</button>
          <button type="button" className="secondary" onClick={closeForm} disabled={saving}>Tühista</button>
        </div>
      </form>
    </section>
  );

  return <ProjectListView projects={projects} loadError={loadError} formOpen={formOpen} form={form} onOpenForm={() => setFormOpen(true)} />;
}
