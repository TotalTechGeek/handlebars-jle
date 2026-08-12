import { performance } from 'node:perf_hooks'
import { LogicEngine } from 'json-logic-engine'
import { parse as jlGrammar, tokenize } from '../parser/jl-parser-entry.js'
import { Cases } from '../index.test.js'
import { setupEngine } from '../methods.js'

const methods = setupEngine(new LogicEngine()).methods
const templates = Object.values(Cases())
  .filter(value => typeof value === 'string' && value.includes('{{'))

function measure (fn, iterations) {
  for (let i = 0; i < 5_000; i++) fn(templates[i % templates.length])
  const samples = new Array(7)
  for (let round = 0; round < samples.length; round++) {
    const start = performance.now()
    for (let i = 0; i < iterations; i++) fn(templates[i % templates.length])
    samples[round] = performance.now() - start
  }
  samples.sort((a, b) => a - b)
  return iterations / samples[3] * 1000
}

for (const [name, fn] of [
  ['jl mode lexer', tokenize],
  ['grammatik', source => jlGrammar(source, { methods })]
]) {
  const rate = measure(fn, 50_000)
  console.log(name.padEnd(12), Math.round(rate).toLocaleString().padStart(12), 'templates/s')
}
