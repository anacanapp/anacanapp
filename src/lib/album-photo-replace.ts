/**
 * Safe photo replacement for the pregnancy and baby albums.
 *
 * Order: upload the new file to a NEW path, then point the record at it, and
 * only then delete the old storage object. If the upload or the record update
 * fails, the original photo is left untouched (a half-uploaded new object is
 * cleaned up). A failed delete of the old object only leaves an orphan file;
 * the user still sees the new photo.
 */

type StorageError = { message?: string } | null;

export interface AlbumStorageBucket {
  upload(path: string, file: Blob | File): PromiseLike<{ error: StorageError }>;
  remove(paths: string[]): PromiseLike<{ error: StorageError }>;
}

export interface AlbumStorageClient {
  storage: { from(bucket: string): AlbumStorageBucket };
}

export interface AlbumDbClient extends AlbumStorageClient {
  from(table: string): {
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): PromiseLike<{ error: StorageError }>;
    };
  };
}

/**
 * Extracts the object path inside `bucket` from a stored public/signed URL or a
 * bare path. Strips any query string (signed URLs carry `?token=`).
 */
export function storagePathFromUrl(url: string, bucket: string): string {
  const marker = `/${bucket}/`;
  const index = url.indexOf(marker);
  let path = index >= 0 ? url.slice(index + marker.length) : url;
  path = path.split(/[?#]/)[0];
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

async function removeQuietly(bucket: AlbumStorageBucket, path: string): Promise<void> {
  try {
    const { error } = await bucket.remove([path]);
    if (error) console.warn('[album] could not remove object', error.message ?? error);
  } catch (error) {
    console.warn('[album] could not remove object', error);
  }
}

export interface ReplaceRecordPhotoInput {
  bucket: string;
  table: string;
  recordId: string;
  oldPath: string | null;
  newPath: string;
  newUrl: string;
  file: Blob | File;
  /** Column holding the URL/path; default `photo_url`. */
  column?: string;
}

/** Pregnancy album: storage object + DB row. */
export async function replaceRecordPhoto(client: AlbumDbClient, input: ReplaceRecordPhotoInput): Promise<void> {
  const bucket = client.storage.from(input.bucket);
  const { error: uploadError } = await bucket.upload(input.newPath, input.file);
  if (uploadError) throw uploadError;

  const { error: dbError } = await client
    .from(input.table)
    .update({ [input.column ?? 'photo_url']: input.newUrl })
    .eq('id', input.recordId);
  if (dbError) {
    await removeQuietly(bucket, input.newPath);
    throw dbError;
  }

  if (input.oldPath && input.oldPath !== input.newPath) await removeQuietly(bucket, input.oldPath);
}

export interface ReplaceStoragePhotoInput {
  bucket: string;
  oldPath: string;
  newPath: string;
  file: Blob | File;
}

/** Baby album: storage only (the listing is the record). */
export async function replaceStoragePhoto(client: AlbumStorageClient, input: ReplaceStoragePhotoInput): Promise<void> {
  const bucket = client.storage.from(input.bucket);
  const { error: uploadError } = await bucket.upload(input.newPath, input.file);
  if (uploadError) throw uploadError;
  if (input.oldPath !== input.newPath) await removeQuietly(bucket, input.oldPath);
}
