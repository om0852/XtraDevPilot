// Zero-dependency terminal formatting utilities for XtraDevPilot CLI

export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
};

export function success(msg) {
  return `${colors.green}✔${colors.reset} ${msg}`;
}

export function error(msg) {
  return `${colors.red}✖${colors.reset} ${msg}`;
}

export function info(msg) {
  return `${colors.cyan}ℹ${colors.reset} ${msg}`;
}

export function warn(msg) {
  return `${colors.yellow}⚠${colors.reset} ${msg}`;
}

export function bold(msg) {
  return `${colors.bold}${msg}${colors.reset}`;
}

export function dim(msg) {
  return `${colors.dim}${msg}${colors.reset}`;
}

export function cyan(msg) {
  return `${colors.cyan}${msg}${colors.reset}`;
}

export function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

export function printTable(headers, rows) {
  const colWidths = headers.map((h, i) => {
    let max = h.length;
    for (const row of rows) {
      const cell = String(row[i] ?? '');
      if (cell.length > max) max = cell.length;
    }
    return Math.min(max, 50); // cap max width at 50 chars
  });

  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join('  ');
  const separator = colWidths.map(w => '─'.repeat(w)).join('  ');

  console.log(colors.bold + colors.cyan + headerLine + colors.reset);
  console.log(colors.dim + separator + colors.reset);

  for (const row of rows) {
    const line = row.map((cell, i) => {
      let str = String(cell ?? '');
      if (str.length > colWidths[i]) {
        str = str.substring(0, colWidths[i] - 3) + '...';
      }
      return str.padEnd(colWidths[i]);
    }).join('  ');
    console.log(line);
  }
}
