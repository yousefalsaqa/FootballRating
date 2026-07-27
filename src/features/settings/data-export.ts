import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import {
  exportSnapshot,
  exportSnapshotSchema,
  importSnapshot,
  type ImportResult,
} from '@/features/settings/repository';

/** Share the whole database as a JSON file via the system share sheet. */
export async function exportDataToFile(now: number): Promise<void> {
  const snapshot = await exportSnapshot(now);
  const name = `journalist-rater-${new Date(now).toISOString().slice(0, 10)}.json`;
  const file = new File(Paths.cache, name);
  if (file.exists) {
    file.delete();
  }
  file.write(JSON.stringify(snapshot));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export data' });
}

export type ImportOutcome =
  | { status: 'imported'; result: ImportResult }
  | { status: 'cancelled' }
  | { status: 'invalid' };

/** Pick a previously exported JSON file and merge it in (never overwrites). */
export async function importDataFromFile(): Promise<ImportOutcome> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets[0]) {
    return { status: 'cancelled' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await new File(picked.assets[0].uri).text());
  } catch {
    return { status: 'invalid' };
  }
  const snapshot = exportSnapshotSchema.safeParse(parsed);
  if (!snapshot.success) {
    return { status: 'invalid' };
  }
  return { status: 'imported', result: await importSnapshot(snapshot.data) };
}
