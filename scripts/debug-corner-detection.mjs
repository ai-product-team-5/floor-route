import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const inputPath = process.argv[2];
const outputRoot =
  process.argv[3] ??
  path.join(
    process.cwd(),
    'debug-output',
    'corner-detection',
    `${new Date().toISOString().replace(/[:.]/g, '-')}`,
  );

if (!inputPath) {
  console.error('Usage: npm run test:corners -- <image-path> [output-dir]');
  process.exit(1);
}

const port = await getFreePort();
const server =
  process.platform === 'win32'
    ? spawn(
        process.env.ComSpec ?? 'cmd.exe',
        [
          '/d',
          '/s',
          '/c',
          `npm run dev -- --host 127.0.0.1 --port ${port}`,
        ],
        {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )
    : spawn(
        'npm',
        ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)],
        {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

let browser;

try {
  await waitForVite(port, server);

  const dataUrl = await imageFileToDataUrl(path.resolve(inputPath));

  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle' });

  const debugOutput = await page.evaluate(async (imageDataUrl) => {
    const module = await import(
      '/src/features/navigation-session/correction/floorPlanCornerDetection.ts'
    );

    return module.createFloorPlanCornerDetectionDebug(imageDataUrl);
  }, dataUrl);

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  for (const [name, stageDataUrl] of Object.entries(debugOutput.stages)) {
    await writeDataUrlAsFile(stageDataUrl, path.join(outputRoot, `${name}.png`));
  }

  const summary = {
    input: path.resolve(inputPath),
    outputRoot,
    image: debugOutput.image,
    result: debugOutput.result,
    metrics: debugOutput.metrics,
  };

  await writeFile(
    path.join(outputRoot, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );

  console.log(`Corner detection debug output written to: ${outputRoot}`);
  console.log(JSON.stringify(summary.result, null, 2));
} finally {
  await browser?.close();
  stopProcessTree(server);
}

async function imageFileToDataUrl(filePath) {
  const buffer = await readFile(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const mime =
    extension === '.png'
      ? 'image/png'
      : extension === '.webp'
        ? 'image/webp'
        : 'image/jpeg';

  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function writeDataUrlAsFile(dataUrl, filePath) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  await writeFile(filePath, Buffer.from(base64, 'base64'));
}

async function getFreePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 5173;

  server.close();
  await once(server, 'close');

  return port;
}

async function waitForVite(port, childProcess) {
  let stderr = '';

  childProcess.stdout.on('data', () => {});
  childProcess.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (childProcess.exitCode !== null) {
      throw new Error(`Vite exited early.\n${stderr}`);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until Vite is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for Vite on port ${port}.\n${stderr}`);
}

function stopProcessTree(childProcess) {
  if (!childProcess.pid) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(childProcess.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
    return;
  }

  childProcess.kill();
}
