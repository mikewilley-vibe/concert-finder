const SMALL_LEADING = /^(the|a|an)\s+/;

export function normalizeNameForComparison(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['\u2019.`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingSmallWords(value: string) {
  return value.replace(SMALL_LEADING, "").trim();
}

function damerauLevenshtein(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array<number>(cols).fill(0),
  );

  for (let i = 0; i < rows; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j < cols; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }

  return matrix[a.length][b.length];
}

function ratio(a: string, b: string) {
  if (!a || !b) {
    return 0;
  }
  if (a === b) {
    return 1;
  }
  return 1 - damerauLevenshtein(a, b) / Math.max(a.length, b.length);
}

function collapseRepeats(value: string) {
  return value.replace(/(.)\1+/g, "$1");
}

export function nameSimilarity(query: string, candidate: string) {
  const q = normalizeNameForComparison(query);
  const c = normalizeNameForComparison(candidate);
  if (!q || !c) {
    return 0;
  }

  const qCore = stripLeadingSmallWords(q);
  const cCore = stripLeadingSmallWords(c);
  const scores = [
    ratio(q, c),
    ratio(qCore, cCore),
    ratio(collapseRepeats(qCore), collapseRepeats(cCore)),
  ];

  return Math.max(...scores);
}

export const DIRECT_NAME_SIMILARITY = 0.88;
export const SUGGEST_NAME_SIMILARITY = 0.76;
export const MAX_NAME_SUGGESTIONS = 3;

export function isDirectNameMatch(query: string, candidate: string) {
  const q = normalizeNameForComparison(query);
  const c = normalizeNameForComparison(candidate);
  if (!q || !c) {
    return false;
  }
  if (q === c || stripLeadingSmallWords(q) === stripLeadingSmallWords(c)) {
    return true;
  }
  if (c.startsWith(q) && q.length >= 4) {
    return true;
  }
  return nameSimilarity(query, candidate) >= DIRECT_NAME_SIMILARITY;
}

export function fallbackSearchToken(keyword: string) {
  const normalized = normalizeNameForComparison(keyword);
  const core = stripLeadingSmallWords(normalized);
  const tokens = core.split(" ").filter((token) => token.length >= 3);
  if (tokens.length >= 2) {
    return tokens[0];
  }
  if (core.length >= 5) {
    return core.slice(0, -1);
  }
  return null;
}
