export function formatSize(size: number): string {
  const UNITS = ["B", "KB", "MB", "GB", "TB"];
  let sizeFloat = size;
  let unitIdx = 0;

  while (sizeFloat >= 1024 && unitIdx < UNITS.length - 1) {
    sizeFloat /= 1024;
    unitIdx += 1;
  }

  if (unitIdx === 0) {
    return `${Math.floor(sizeFloat)} ${UNITS[unitIdx]}`;
  } else {
    return `${sizeFloat.toFixed(2)} ${UNITS[unitIdx]}`;
  }
}
