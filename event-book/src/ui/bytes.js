// Sizes for people: "1.2 MB", "12 MB", "340 KB" (KB under 1 MB)
export function formatBytes(n) {
  const mb = 1024 * 1024;
  if (n >= mb) return `${(n / mb).toFixed(n >= 10 * mb ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}
