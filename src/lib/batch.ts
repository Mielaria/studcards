// Procesamiento por lotes con cedencia del hilo: evita congelar la interfaz
// cuando se transforman miles de elementos (exportar/importar cartas).

export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function mapBatched<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize = 20,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    out.push(...(await Promise.all(batch.map(fn))));
    await yieldToUi();
  }
  return out;
}
