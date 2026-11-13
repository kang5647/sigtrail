import { writeFile, rename, mkdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// Stage every artifact before replacing any published file. Rename is atomic
// for each file on the same filesystem; snapshot.json is switched last.
export async function writeArtifacts(directoryUrl, files) {
  await mkdir(directoryUrl, { recursive: true });
  const staged = [];
  try {
    for (const [name, contents] of Object.entries(files)) {
      const path = new URL(`${name}.${randomUUID()}.tmp`, directoryUrl);
      await writeFile(path, contents);
      staged.push({ name, path });
    }
    for (const item of staged.filter(item => item.name !== 'snapshot.json')) {
      await rename(item.path, new URL(item.name, directoryUrl));
    }
    const snapshot = staged.find(item => item.name === 'snapshot.json');
    if (snapshot) await rename(snapshot.path, new URL(snapshot.name, directoryUrl));
  } finally {
    await Promise.all(staged.map(item => rm(item.path, { force: true })));
  }
}
