// Shape project save/load utilities
import type { BaseShape } from '../types/shapes'

/**
 * Save shapes to a JSON file and trigger download
 */
export function saveShapesToFile(shapes: BaseShape[], projectName: string): void {
  const data = JSON.stringify(shapes, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${projectName}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Load shapes from a JSON file
 */
export function loadShapesFromFile(): Promise<BaseShape[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) {
        reject(new Error('No file selected'))
        return
      }
      try {
        const text = await file.text()
        const data = JSON.parse(text) as BaseShape[]
        if (!Array.isArray(data)) {
          reject(new Error('Invalid project file: expected an array of shapes'))
          return
        }
        resolve(data)
      } catch (err) {
        reject(new Error('Failed to parse project file'))
      }
    }
    input.click()
  })
}
