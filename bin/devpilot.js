#!/usr/bin/env node
import { runCli } from '../cli/index.js';

runCli().then((code) => {
  process.exit(code ?? 0);
}).catch((err) => {
  console.error("Fatal CLI error:", err);
  process.exit(1);
});
