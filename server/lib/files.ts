import path from "path";

export function getSafeFilename(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const normalized = path.posix.normalize(trimmed);
  const basename = path.posix.basename(normalized);

  if (
    basename !== trimmed ||
    normalized.includes("..") ||
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    path.isAbsolute(trimmed)
  ) {
    return null;
  }

  return basename;
}

export function resolveFileWithin(baseDir: string, filename: string): string | null {
  const targetPath = path.resolve(baseDir, filename);
  const relative = path.relative(baseDir, targetPath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return targetPath;
}
