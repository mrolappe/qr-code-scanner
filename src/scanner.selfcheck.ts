import { pickEngine } from './scanner.ts'

// ponytail: hand-rolled instead of node:assert — no @types/node in this project's tsconfig
function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) throw new Error(`expected ${String(expected)}, got ${String(actual)}`)
}

assertEqual(pickEngine(false, false), 'qr-scanner')
assertEqual(pickEngine(true, false), 'qr-scanner')
assertEqual(pickEngine(false, true), 'qr-scanner')
assertEqual(pickEngine(true, true), 'barcode-detector')

console.log('scanner selfcheck OK')
