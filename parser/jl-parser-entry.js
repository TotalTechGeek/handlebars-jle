/**
 * The parser's public face.
 *
 * Everything below is generated from `handlebars.gram` — the lexer with its
 * modes, the rules, and the semantic methods, which the generated module
 * registers itself. `parseTemplate` comes from the grammar's `methods` block,
 * so there is no wiring left to do here.
 */

export { parseTemplate as parse, tokenize, tokens, start } from './jl-parser.generated.js'
