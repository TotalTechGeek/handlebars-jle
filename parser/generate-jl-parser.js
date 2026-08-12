import { readFile, writeFile } from 'node:fs/promises'
import { parseDefinition, emitModule } from 'grammatik'

/**
 * Generates `parser/jl-parser.generated.js` from `parser/handlebars.gram`.
 *
 * The grammar file is the whole specification: token vocabulary, lexer modes,
 * parser rules, JSON Logic actions, and — in its `methods` block — the
 * JavaScript those actions call. Nothing here supplies anything but the file.
 */

const grammar = parseDefinition(await readFile(new URL('./handlebars.gram', import.meta.url), 'utf8'))

const source = emitModule(grammar, {
  moduleName: 'handlebars',
  // Templates report errors by offset; skipping the newline scan is free speed.
  positions: 'offset'
})

await writeFile(new URL('./jl-parser.generated.js', import.meta.url), source)

const engineFree = !/^(?:import|const) .*json-logic-engine/m.test(source)
console.log(
  `Generated parser/jl-parser.generated.js (${source.length} bytes, ` +
  `${Object.keys(grammar.rules).length} rules${engineFree ? ', no json-logic-engine dependency' : ''})`
)
