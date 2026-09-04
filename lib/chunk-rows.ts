export function chunkRows<T>(rows: T[], size: number) {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError("Chunk size must be a positive integer.");
  }
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}
