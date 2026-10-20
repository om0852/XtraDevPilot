import fs from 'node:fs';
import path from 'node:path';

/**
 * Normalizes virtual sourcemap paths into clean relative file paths.
 * Handles webpack:///, vite:///, turbopack:///, rollup:///, file:///, and Windows path sanitization.
 */
export function normalizeSourcePath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return `source_${Math.random().toString(36).substring(7)}.js`;

  let cleaned = rawPath;

  // Remove URL schemes and virtual root indicators
  cleaned = cleaned.replace(/^(webpack|vite|rollup|turbopack|turbopack-virtual):\/\/?(\[project\]\/)?/i, '');
  cleaned = cleaned.replace(/^file:\/\/\/?/i, '');
  cleaned = cleaned.replace(/^webpack-internal:\/\/\/?/i, '');
  cleaned = cleaned.replace(/^\(\w+\)\//, '');

  // Strip query parameters and hash fragments (e.g. App.tsx?b4e1 or style.css?vue&type=style)
  cleaned = cleaned.split('?')[0].split('#')[0];

  // Remove leading slashes and relative backtracking dots
  cleaned = cleaned.replace(/^[\/\\]+/, '');
  cleaned = cleaned.replace(/^(\.\.[\/\\])+/, '');
  cleaned = cleaned.replace(/^(\.[\/\\])+/, '');

  // Sanitize Windows invalid path characters (< > : " | ? *)
  cleaned = cleaned.replace(/[:*?"<>|]/g, '_');

  // Convert all slashes to standard forward slashes for internal path resolution
  cleaned = cleaned.replace(/\\/g, '/');

  // If path is empty or just dots after sanitization, assign a safe fallback
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    cleaned = `unnamed_source_${Math.random().toString(36).substring(7)}.js`;
  }

  return cleaned;
}

/**
 * Detects framework and technologies from reconstructed file paths.
 */
export function detectProjectTechStack(filePaths) {
  const stack = new Set();
  for (const fp of filePaths) {
    const lower = fp.toLowerCase();
    if (lower.includes('react') || lower.endsWith('.tsx') || lower.endsWith('.jsx')) stack.add('React');
    if (lower.includes('next/') || lower.includes('_app.') || lower.includes('_document.') || lower.includes('app/page.')) stack.add('Next.js');
    if (lower.endsWith('.vue') || lower.includes('vue-router') || lower.includes('pinia')) stack.add('Vue');
    if (lower.endsWith('.svelte')) stack.add('Svelte');
    if (lower.endsWith('.ts') || lower.endsWith('.tsx')) stack.add('TypeScript');
    if (lower.includes('tailwind') || lower.includes('tailwind.config')) stack.add('TailwindCSS');
    if (lower.includes('redux') || lower.includes('zustand') || lower.includes('mobx')) stack.add('State Management');
    if (lower.includes('vite.config')) stack.add('Vite');
  }
  return Array.from(stack);
}

/**
 * Unpacks a single SourceMap V3 object or JSON string into the target output directory.
 */
export function unpackSourceMap(mapData, outputDir, sourceLabel = 'sourcemap') {
  let map;
  try {
    map = typeof mapData === 'string' ? JSON.parse(mapData) : mapData;
  } catch (err) {
    throw new Error(`Invalid SourceMap JSON (${sourceLabel}): ${err.message}`);
  }

  if (!map || typeof map !== 'object') {
    throw new Error(`Invalid SourceMap object (${sourceLabel})`);
  }

  const sources = Array.isArray(map.sources) ? map.sources : [];
  const sourcesContent = Array.isArray(map.sourcesContent) ? map.sourcesContent : [];

  if (sources.length === 0) {
    return {
      success: true,
      filesCount: 0,
      totalBytes: 0,
      files: [],
      warning: "Sourcemap contains empty 'sources' array."
    };
  }

  if (sourcesContent.length === 0) {
    return {
      success: true,
      filesCount: 0,
      totalBytes: 0,
      files: [],
      warning: "Sourcemap contains 'sources' list but 'sourcesContent' is empty (external sources not embedded)."
    };
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const writtenFiles = [];
  let totalBytes = 0;
  const writtenPaths = new Set();

  for (let i = 0; i < sources.length; i++) {
    const rawPath = sources[i];
    const content = sourcesContent[i];

    if (content === null || content === undefined) continue;

    const normalizedPath = normalizeSourcePath(rawPath);
    let targetRelative = normalizedPath;

    // Handle deduplication of conflicting relative names
    if (writtenPaths.has(targetRelative)) {
      const ext = path.extname(targetRelative);
      const base = targetRelative.slice(0, targetRelative.length - ext.length);
      targetRelative = `${base}_${i}${ext}`;
    }
    writtenPaths.add(targetRelative);

    const fullTargetPath = path.resolve(outputDir, targetRelative);
    const targetFolder = path.dirname(fullTargetPath);

    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    fs.writeFileSync(fullTargetPath, content, 'utf8');
    const bytes = Buffer.byteLength(content, 'utf8');
    totalBytes += bytes;

    writtenFiles.push({
      originalSource: rawPath,
      relativePath: targetRelative,
      sizeBytes: bytes,
      extension: path.extname(targetRelative).toLowerCase() || '.js'
    });
  }

  return {
    success: true,
    filesCount: writtenFiles.length,
    totalBytes,
    files: writtenFiles
  };
}

/**
 * Extracts inline base64 sourcemaps from JavaScript content if present.
 */
export function extractInlineSourceMap(jsContent) {
  if (!jsContent || typeof jsContent !== 'string') return null;

  const inlineRegex = /\/\/[#@] sourceMappingURL=data:application\/json;(?:charset=[^;]+;)?base64,([A-Za-z0-9+/=]+)/;
  const match = jsContent.match(inlineRegex);
  if (!match) return null;

  try {
    const base64 = match[1];
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

/**
 * Extracts individual Webpack / Turbopack bundled modules when sourcemaps are missing.
 * Splits chunk functions into separate module files with clean headers.
 */
export function extractBundleModules(jsContent, outputDir, chunkName = 'bundle') {
  if (!jsContent || typeof jsContent !== 'string') return { modulesCount: 0, files: [] };

  const modulesDir = path.resolve(outputDir, 'extracted-modules', chunkName);
  const written = [];

  // 1. Webpack / Turbopack module object pattern: e.g. { 1234: function(module, exports, __webpack_require__) { ... } }
  // or { "./src/components/Button.js": function(...) { ... } }
  const moduleBlockRegex = /(?:["']([^"']+\.[a-zA-Z0-9]+)["']|\b(\d{1,6})\b)\s*:\s*(?:function\s*\(([^)]*)\)|\(([^)]*)\)\s*=>)\s*\{/g;
  
  let match;
  let moduleCount = 0;

  while ((match = moduleBlockRegex.exec(jsContent)) !== null && moduleCount < 200) {
    const modIdentifier = match[1] || `module_${match[2]}`;
    const startIdx = match.index;
    
    // Find matching bracket for this module
    let depth = 0;
    let endIdx = -1;
    const searchArea = jsContent.slice(startIdx, Math.min(startIdx + 150000, jsContent.length));
    
    for (let c = 0; c < searchArea.length; c++) {
      if (searchArea[c] === '{') depth++;
      else if (searchArea[c] === '}') {
        depth--;
        if (depth === 0) {
          endIdx = startIdx + c + 1;
          break;
        }
      }
    }

    if (endIdx !== -1) {
      const codeSlice = jsContent.slice(startIdx, endIdx);
      const safeName = modIdentifier.replace(/[^a-zA-Z0-9._-]/g, '_') + (modIdentifier.includes('.') ? '' : '.js');
      const targetPath = path.resolve(modulesDir, safeName);

      if (!fs.existsSync(modulesDir)) fs.mkdirSync(modulesDir, { recursive: true });

      const header = `// [Extracted Module] Original identifier: ${modIdentifier}\n// Discovered in chunk: ${chunkName}\n\n`;
      fs.writeFileSync(targetPath, header + codeSlice, 'utf8');

      written.push({
        identifier: modIdentifier,
        relativePath: `extracted-modules/${chunkName}/${safeName}`,
        sizeBytes: Buffer.byteLength(codeSlice, 'utf8')
      });
      moduleCount++;
    }
  }

  return { modulesCount: written.length, files: written };
}

/**
 * Scans an entire directory (e.g. downloaded sources directory) and reconstructs the codebase.
 */
export function reconstructCodebaseFromDirectory(inputDir, outputDir) {
  const resolvedInput = path.resolve(process.cwd(), inputDir);
  const resolvedOutput = path.resolve(process.cwd(), outputDir);

  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`Input directory not found: ${resolvedInput}`);
  }

  if (!fs.existsSync(resolvedOutput)) {
    fs.mkdirSync(resolvedOutput, { recursive: true });
  }

  const allFiles = [];
  function collectFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        collectFiles(full);
      } else {
        allFiles.push(full);
      }
    }
  }
  collectFiles(resolvedInput);

  const mapFiles = allFiles.filter(f => f.toLowerCase().endsWith('.map'));
  const jsFiles = allFiles.filter(f => f.toLowerCase().endsWith('.js'));

  let totalReconstructedFiles = 0;
  let totalReconstructedBytes = 0;
  const processedSources = [];
  const processedMaps = [];
  const extractedModulesList = [];

  // 1. Process explicit .map files
  for (const mapFile of mapFiles) {
    try {
      const content = fs.readFileSync(mapFile, 'utf8');
      const relMap = path.relative(resolvedInput, mapFile);
      const res = unpackSourceMap(content, resolvedOutput, relMap);
      if (res.filesCount > 0) {
        totalReconstructedFiles += res.filesCount;
        totalReconstructedBytes += res.totalBytes;
        processedSources.push(...res.files);
        processedMaps.push({
          mapFile: relMap,
          filesExtracted: res.filesCount,
          bytes: res.totalBytes
        });
      }
    } catch (e) {
      // Continue on error
    }
  }

  // 2. Process JS files for inline sourcemaps or module chunks
  for (const jsFile of jsFiles) {
    try {
      const content = fs.readFileSync(jsFile, 'utf8');
      const inlineMap = extractInlineSourceMap(content);
      const relJs = path.relative(resolvedInput, jsFile);

      if (inlineMap) {
        const res = unpackSourceMap(inlineMap, resolvedOutput, `inline in ${relJs}`);
        if (res.filesCount > 0) {
          totalReconstructedFiles += res.filesCount;
          totalReconstructedBytes += res.totalBytes;
          processedSources.push(...res.files);
          processedMaps.push({
            mapFile: `inline:${relJs}`,
            filesExtracted: res.filesCount,
            bytes: res.totalBytes
          });
        }
      } else if (mapFiles.length === 0) {
        // Fallback: If no sourcemaps are found anywhere, attempt bundle module extraction
        const chunkName = path.basename(jsFile, '.js');
        const extracted = extractBundleModules(content, resolvedOutput, chunkName);
        if (extracted.modulesCount > 0) {
          extractedModulesList.push(...extracted.files);
        }
      }
    } catch (e) {
      // Continue on error
    }
  }

  // Language & tech stack analysis
  const relativeList = processedSources.map(s => s.relativePath);
  const techStack = detectProjectTechStack(relativeList);
  const extensionsMap = {};

  for (const s of processedSources) {
    const ext = s.extension || 'other';
    extensionsMap[ext] = (extensionsMap[ext] || 0) + 1;
  }

  // Build manifest
  const manifest = {
    reconstructionDate: new Date().toISOString(),
    inputDirectory: resolvedInput,
    outputDirectory: resolvedOutput,
    totalFiles: totalReconstructedFiles,
    totalSizeKB: Math.round((totalReconstructedBytes / 1024) * 100) / 100,
    detectedTechStack: techStack,
    extensionBreakdown: extensionsMap,
    processedSourceMaps: processedMaps,
    reconstructedFiles: processedSources.slice(0, 500),
    extractedModulesCount: extractedModulesList.length,
    extractedModules: extractedModulesList.slice(0, 100)
  };

  const manifestPath = path.resolve(resolvedOutput, 'reconstruction-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return {
    success: true,
    outputDirectory: resolvedOutput,
    totalFiles: totalReconstructedFiles,
    totalSizeKB: manifest.totalSizeKB,
    detectedTechStack: techStack,
    manifestPath,
    extractedModulesCount: extractedModulesList.length,
    hasSourceMaps: processedMaps.length > 0
  };
}
