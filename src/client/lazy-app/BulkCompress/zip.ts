import { zipSync } from 'fflate';

interface ZipEntry {
  name: string;
  data: Blob;
}

function dedupeNames(entries: ZipEntry[]): string[] {
  const used = new Set<string>();
  return entries.map(({ name }) => {
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
    const dotIndex = name.lastIndexOf('.');
    const base = dotIndex === -1 ? name : name.slice(0, dotIndex);
    const ext = dotIndex === -1 ? '' : name.slice(dotIndex);
    let n = 2;
    let candidate = `${base} (${n})${ext}`;
    while (used.has(candidate)) {
      n++;
      candidate = `${base} (${n})${ext}`;
    }
    used.add(candidate);
    return candidate;
  });
}

export async function createZip(entries: ZipEntry[]): Promise<Blob> {
  const names = dedupeNames(entries);
  const files: Record<string, Uint8Array> = {};

  await Promise.all(
    entries.map(async ({ data }, i) => {
      files[names[i]] = new Uint8Array(await data.arrayBuffer());
    }),
  );

  const zipped = zipSync(files, { level: 0 });
  return new Blob([zipped], { type: 'application/zip' });
}
