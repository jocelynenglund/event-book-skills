// ===========================================
// SOURCE - Links into the code a model was built from (repo + commit, from a test export)
// ===========================================

// The repo's web address ('owner/name' is on GitHub), or null
export function repoUrl(state) {
  const repo = state?.modelSource?.repo;
  if (!repo) return null;
  return /^https?:\/\//.test(repo) ? repo.replace(/\/+$/, '') : `https://github.com/${repo.replace(/\/+$/, '')}`;
}

// The repo's name for a link: 'owner/name'
export const repoName = state => (repoUrl(state) || '').replace(/^https?:\/\/(www\.)?github\.com\//, '');

// A commit in the repo, or null
export const commitUrl = (state, sha) => repoUrl(state) && sha ? `${repoUrl(state)}/commit/${sha}` : null;

export function sourceUrl(state, file, line) {
  const base = repoUrl(state);
  if (!base || !file) return null;
  return `${base}/blob/${state.modelSource.commit || 'HEAD'}/${file}${line ? `#L${line}` : ''}`;
}

// "🧪 tests @ f29156c · build 412 · 25 Oct, 10:31": tells same-named imports apart
export function sourceSummary(state) {
  const src = state?.modelSource;
  if (!src?.commit) return '';
  const when = src.createdAt ? new Date(src.createdAt) : null;
  const at = when && !isNaN(when) ? when.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  return ['🧪 tests @ ' + src.commit.slice(0, 7), src.build ? `build ${src.build}` : '', at].filter(Boolean).join(' · ');
}

export const sourceLabel = src => src?.file ? `${src.file}${src.line ? `:${src.line}` : ''}` : '';
