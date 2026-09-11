// Command-line flags for the bench and the scripts: `--name value`, or `--name` alone for true. Anything that is not a
// flag or a flag's value lands in `_`.

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { out[a.slice(2)] = next; i++; } else out[a.slice(2)] = true;
    } else out._.push(a);
  }
  return out;
}
