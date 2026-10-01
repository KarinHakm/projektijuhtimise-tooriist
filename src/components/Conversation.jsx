import { useCallback, useEffect, useState } from 'react';
import { continueConversation, getConversation, sendAnswers, sendIdea } from '../api.js';
import { allAnswered, buildAnswers, conversationPhase, describeAnswer, emptyDraft } from '../conversation/answers.js';
import AiError from './AiError.jsx';
import AiWait from './AiWait.jsx';
import QuestionCard from './QuestionCard.jsx';

const POLL_MS = 3000;

// Juhitud vestlus (L04): idee → AI täpsustavad küsimused → vastused → kokkuvõte.
// Vestluse seis tuleb alati serverist; lehe värskendamisel jätkub samast kohast.
export default function Conversation({ projectId, onPhaseChange }) {
  const [data, setData] = useState(null); // { messages, aiRunning }
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false); // meie enda päring käib
  const [error, setError] = useState(null);
  const [idea, setIdea] = useState('');
  const [ideaError, setIdeaError] = useState('');
  const [drafts, setDrafts] = useState({});

  const refresh = useCallback(async () => {
    try {
      setData(await getConversation(projectId));
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Kui AI töötab (nt pärast lehe värskendamist), küsi seisu uuesti, kuni vastus on valmis.
  useEffect(() => {
    if (!data?.aiRunning || busy) return undefined;
    const timer = setTimeout(refresh, POLL_MS);
    return () => clearTimeout(timer);
  }, [data, busy, refresh]);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      setData(await action());
    } catch (e) {
      // "in_progress" ei ole viga: AI juba töötab (nt teises vahelehes) ja vaade ootab seda.
      if (e.code !== 'in_progress') setError(e);
      await refresh(); // server võis idee või vastused enne viga salvestada
    } finally {
      setBusy(false);
    }
  }

  function submitIdea(e) {
    e.preventDefault();
    if (!idea.trim()) {
      setIdeaError('Kirjelda ideed vähemalt ühe lausega.');
      return;
    }
    setIdeaError('');
    run(() => sendIdea(projectId, idea));
  }

  const phase = data ? conversationPhase(data.messages, data.aiRunning) : null;
  useEffect(() => { if (phase) onPhaseChange?.(phase); }, [phase, onPhaseChange]);

  if (loadError) return <p className="error">Vestlust ei saanud laadida: {loadError}</p>;
  if (!data) return <p className="muted">Laadin vestlust…</p>;

  const { messages } = data;
  const questionsById = new Map(messages.filter((m) => m.kind === 'questions').flatMap((m) => m.content.questions.map((q) => [q.id, q])));
  const openQuestions = phase === 'questions' ? messages.at(-1) : null;

  return (
    <section className="conversation" aria-label="Juhitud vestlus">
      {phase === 'empty' && (
        <form onSubmit={submitIdea} noValidate>
          <label htmlFor="idea">Kirjelda kliendi ideed ühe-kahe lausega</label>
          <textarea
            id="idea"
            rows={3}
            maxLength={2000}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            disabled={busy}
            aria-invalid={Boolean(ideaError || error?.field === 'text')}
            placeholder="Nt: Spordiklubi tahab veebi, kus saab treeningutega tutvuda ja liikmeks astuda."
          />
          {(ideaError || error?.field === 'text') && <p className="error">{ideaError || error.message}</p>}
          <button type="submit" disabled={busy}>Alusta</button>
        </form>
      )}

      {messages.map((m) => (
        <Message key={m.id} message={m} questionsById={questionsById} isOpen={m === openQuestions} />
      ))}

      {openQuestions && (
        <AnswerForm
          key={openQuestions.id}
          message={openQuestions}
          drafts={drafts}
          setDrafts={setDrafts}
          busy={busy}
          error={error}
          onSubmit={(answers) => run(() => sendAnswers(projectId, openQuestions.id, answers))}
        />
      )}

      {(busy || phase === 'waiting') && <AiWait label="AI koostab vastust" />}

      {phase === 'unanswered' && !busy && (
        <AiError
          error={error && !error.field ? error : { message: 'AI vastus jäi saamata. Proovi uuesti.' }}
          onRetry={() => run(() => continueConversation(projectId))}
          retrying={busy}
        />
      )}

    </section>
  );
}

function Message({ message, questionsById, isOpen }) {
  const { role, kind, content } = message;
  return (
    <div className={`msg ${role === 'user' ? 'msg--user' : 'msg--ai'}`}>
      <p className="msg__who">{role === 'user' ? 'Sina' : content.demo ? 'Näidis (käsitsi koostatud, mitte AI)' : 'AI'}</p>
      {kind === 'idea' && <p>{content.text}</p>}
      {kind === 'questions' && (
        <>
          <p>{content.message}</p>
          {!isOpen && (
            <ol className="msg__list">
              {content.questions.map((q) => <li key={q.id}>{q.text}</li>)}
            </ol>
          )}
        </>
      )}
      {kind === 'answers' && (
        <ul className="msg__list">
          {content.answers.map((a) => (
            <li key={a.questionId}>
              <span className="muted">{questionsById.get(a.questionId)?.text ?? a.questionId}</span> {describeAnswer(questionsById.get(a.questionId), a)}
            </li>
          ))}
        </ul>
      )}
      {kind === 'summary' && (
        <>
          <p>{content.message}</p>
          <p>{content.summary}</p>
        </>
      )}
    </div>
  );
}

function AnswerForm({ message, drafts, setDrafts, busy, error, onSubmit }) {
  const { questions } = message.content;
  const ready = allAnswered(questions, drafts);

  return (
    <form
      className="answer-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit(buildAnswers(questions, drafts));
      }}
    >
      {questions.map((q) => (
        <QuestionCard
          key={q.id}
          question={q}
          draft={drafts[q.id] ?? emptyDraft()}
          onChange={(d) => setDrafts((all) => ({ ...all, [q.id]: d }))}
          disabled={busy}
        />
      ))}
      {error && !busy && <p className="error">{error.message}</p>}
      <button type="submit" disabled={busy || !ready}>Saada vastused</button>
      {!ready && !busy && <p className="muted">Vasta igale küsimusele, kirjuta oma vastus või jäta küsimus vahele.</p>}
    </form>
  );
}
