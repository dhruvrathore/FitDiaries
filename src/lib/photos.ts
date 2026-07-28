import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';

function ensureDir(subdir: string): Directory {
  const dir = new Directory(Paths.document, subdir);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Copy a picked/captured image into permanent app storage; returns its uri. */
function persist(uri: string, subdir: string, prefix: string): string {
  const dir = ensureDir(subdir);
  const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
  const dest = new File(dir, `${prefix}-${Date.now()}.${ext}`);
  const src = new File(uri);
  src.copy(dest);
  return dest.uri;
}

/** Launch the camera; returns a permanent uri or null if cancelled/denied. */
export async function captureImageFile(
  subdir: string,
  prefix: string
): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
  if (res.canceled || !res.assets?.[0]) return null;
  return persist(res.assets[0].uri, subdir, prefix);
}

/** Pick from the library; returns a permanent uri or null if cancelled/denied. */
export async function pickImageFile(subdir: string, prefix: string): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  return persist(res.assets[0].uri, subdir, prefix);
}

/** Best-effort removal of a stored image file. */
export function deleteImageFile(uri: string): void {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // ignore
  }
}

// ---- progress photos (week-scoped) -----------------------------------------

const PHOTO_DIR = 'progress-photos';

export function capturePhoto(weekISO: string): Promise<string | null> {
  return captureImageFile(PHOTO_DIR, `week-${weekISO}`);
}

export function pickPhoto(weekISO: string): Promise<string | null> {
  return pickImageFile(PHOTO_DIR, `week-${weekISO}`);
}

/** Kept for existing callers; alias of deleteImageFile. */
export const deletePhotoFile = deleteImageFile;
