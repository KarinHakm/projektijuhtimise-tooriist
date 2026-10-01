// Võltskäsk testidele: käitub nagu `claude -p --output-format json`, päris AI-d ei kutsuta.
// FAKE_CLAUDE_MODE: ok | ok_text | not_logged_in | not_logged_in_stderr | limit | garbage | hang
// FAKE_CLAUDE_OUTPUT: struktureeritud väljund (JSON); FAKE_CLAUDE_RECORD: fail, kuhu kirjutatakse saadud argumendid jm.
import { readdirSync, writeFileSync } from 'node:fs';

let stdin = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { stdin += c; });
process.stdin.on('end', () => {
  if (process.env.FAKE_CLAUDE_RECORD) {
    writeFileSync(process.env.FAKE_CLAUDE_RECORD, JSON.stringify({
      args: process.argv.slice(2),
      stdin,
      cwd: process.cwd(),
      cwdFiles: readdirSync(process.cwd()),
      hasApiKey: 'ANTHROPIC_API_KEY' in process.env,
      hasAuthToken: 'ANTHROPIC_AUTH_TOKEN' in process.env,
    }));
  }
  const output = JSON.parse(process.env.FAKE_CLAUDE_OUTPUT ?? '{}');
  const result = (fields, code = 0) => { process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, ...fields })); process.exit(code); };
  switch (process.env.FAKE_CLAUDE_MODE) {
    case 'ok': return result({ result: '', structured_output: output, usage: { output_tokens: 42 } });
    case 'ok_text': return result({ result: JSON.stringify(output), usage: { output_tokens: 7 } });
    case 'not_logged_in': return result({ is_error: true, result: 'Not logged in · Please run /login' }, 1);
    case 'not_logged_in_stderr': process.stderr.write('Invalid API key · Please run /login\n'); return process.exit(1);
    case 'limit': return result({ is_error: true, result: `Claude AI usage limit reached|${Math.floor(Date.now() / 1000) + 1800}` }, 1);
    case 'garbage': process.stdout.write('see ei ole JSON'); return process.exit(0);
    case 'hang': return setTimeout(() => {}, 60_000);
    default: return process.exit(2);
  }
});
