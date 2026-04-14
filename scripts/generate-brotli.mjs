/**
 * Post-build Brotli compression script
 * 
 * Workaround for vite-plugin-compression v0.5.1 mtimeCache bug:
 * When both gzip and brotli plugins are used, the mtimeCache is shared
 * at module level, causing brotli to skip all files after gzip runs.
 * 
 * This script generates .br files for all JS/CSS assets after the build.
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { brotliCompress } from 'zlib'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'

const compress = promisify(brotliCompress)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distAssetsDir = path.join(__dirname, '../dist/assets')

function shouldCompress(filename) {
  return /\.(js|css)$/.test(filename) && !filename.endsWith('.gz') && !filename.endsWith('.br')
}

async function main() {
  const files = readdirSync(distAssetsDir).filter(shouldCompress)
  
  if (files.length === 0) {
    console.log('[brotli] No files to compress')
    return
  }
  
  console.log(`[brotli] Generating .br files for ${files.length} files...`)
  
  for (const file of files) {
    const inputPath = path.join(distAssetsDir, file)
    const outputPath = inputPath + '.br'
    const buf = readFileSync(inputPath)
    const compressed = await compress(buf)
    writeFileSync(outputPath, compressed)
    console.log(`  ${file}: ${(buf.byteLength / 1024).toFixed(1)}KB -> ${(compressed.byteLength / 1024).toFixed(1)}KB (${(compressed.byteLength / buf.byteLength * 100).toFixed(1)}%)`)
  }
  
  console.log('[brotli] Done!')
}

main().catch(console.error)
