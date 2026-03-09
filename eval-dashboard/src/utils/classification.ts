export function calculateCorrectness(expected: string, pipeline: string): number {
  if (!expected || !pipeline) return 0;

  const expectedLevels = expected
    .split('|')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const pipelineLevels = pipeline
    .split('|')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!expectedLevels.length || !pipelineLevels.length) return 0;

  for (let i = 0; i < expectedLevels.length; i++) {
    if (i >= pipelineLevels.length) return i;
    if (expectedLevels[i] !== pipelineLevels[i]) return i;
  }

  return expectedLevels.length;
}

export function splitPath(path: string): string[] {
  if (!path) return [];
  return path
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}
