# handlebars-jle

Fast Handlebars-style templates powered by
[json-logic-engine](https://github.com/TotalTechGeek/json-logic-engine).

`handlebars-jle` parses a template directly into a JSON Logic tree. You can
inspect or store that tree, execute it without dynamic code generation, or let
json-logic-engine compile it into an optimized JavaScript function.

```js
import { Handlebars } from 'handlebars-jle'

const handlebars = new Handlebars()
const render = handlebars.compile('Hello, {{name}}!')

render({ name: 'Ada' }) // "Hello, Ada!"
```

## Why use it?

- **Fast reusable templates.** Parse and compile once, then render repeatedly.
- **Portable intermediate form.** Templates lower to ordinary JSON Logic data.
- **Compiled or interpreted execution.** Interpreted mode works in environments
  that prohibit `eval` and `new Function`.
- **Synchronous and asynchronous engines.** Async helpers are first-class.
- **Grammar-native whitespace handling.** `{{~ ... ~}}` and standalone block
  lines are handled by the generated parser, without a preprocessing pass.
- **JSON Logic extensibility.** Helpers are json-logic-engine methods and can
  participate in its determinism and compilation optimizations.

This is a focused Handlebars-compatible language, not a drop-in replacement for
every feature and extension in Handlebars.js. See [Compatibility](#compatibility).

## Installation

```sh
npm install handlebars-jle
```

`json-logic-engine` is installed as a runtime dependency. The grammar toolkit is
only used while building this package; the generated parser and its small runtime
are bundled into the published output.

## Core API

### Compile and render

```js
import { Handlebars } from 'handlebars-jle'

const handlebars = new Handlebars()

const render = handlebars.compile(`
{{#if account}}
  Welcome, {{name}}.
{{else}}
  Please create an account.
{{/if}}
`)

render({ account: true, name: 'Ada' })
```

Templates escape interpolated HTML by default. Disable that per template when
the input is trusted:

```js
const renderTrusted = handlebars.compile('{{html}}', { noEscape: true })
renderTrusted({ html: '<strong>Hello</strong>' })
```

Triple braces are the template-level alternative:

```handlebars
{{{html}}}
```

### Compile to JSON Logic

`compileToJSON()` exposes the intermediate representation without building a
renderer:

```js
import { compileToJSON } from 'handlebars-jle'

compileToJSON('Hello, {{name}}!')
// {
//   cat: [
//     'Hello, ',
//     { escape: { val: 'name' } },
//     '!'
//   ]
// }
```

With `noEscape: true`, the interpolation is emitted as `{ val: 'name' }`.

### Interpreted mode

Compiled mode is the default. Interpreted mode retains the same API but runs the
JSON Logic tree directly:

```js
const handlebars = new Handlebars({ interpreted: true })
const render = handlebars.compile('Hello, {{name}}!')

render({ name: 'Ada' })
```

Use interpreted mode when runtime code generation is unavailable or unwanted.

## Template syntax

### Conditions

```handlebars
{{#if age}}
  {{name}} is {{age}} years old.
{{else if dateOfBirth}}
  {{name}} was born on {{dateOfBirth}}.
{{else}}
  {{name}}'s age is unknown.
{{/if}}
```

`unless` and the inverse marker `^` are also supported:

```handlebars
{{#unless active}}Inactive{{^}}Active{{/unless}}
```

### Iteration

Arrays, iterable values, maps, and objects can be iterated with `each`:

```handlebars
{{#each children}}
  {{@index}}: {{name}} is {{age}}
{{/each}}
```

```js
render({
  children: [
    { name: 'John', age: 5 },
    { name: 'Jane', age: 7 }
  ]
})
```

Inside an object or map iteration, `@key` identifies the current key. The
special values `@first` and `@last` are available as well.

Parent contexts use `../`:

```handlebars
{{#each teams}}
  {{#each players}}
    {{../name}}: {{name}}
  {{/each}}
{{/each}}
```

Block parameters are supported:

```handlebars
{{#each people as |person index|}}
  {{index}}: {{person.name}}
{{/each}}
```

### `with`

`with` accepts a context value, hash arguments, or both:

```handlebars
{{#with person}}
  {{name}} is {{age}} years old.
{{/with}}
```

```handlebars
{{#with name='Ada' role='engineer'}}
  {{name}} is an {{role}}.
{{/with}}
```

### Subexpressions and hash arguments

Helpers can be nested with parentheses and invoked with positional or hash
arguments:

```handlebars
{{uppercase (default displayName name)}}
{{json (obj name=name age=age)}}
```

### Whitespace control

Tildes trim adjacent whitespace:

```handlebars
Hello   {{~name}}!
{{#if ready~}}

  Ready
{{~/if}}
```

Standalone block-open, `else`, and block-close lines consume their indentation
and line ending. Literal content inside the block keeps its own indentation and
newlines.

Escaping a complete element with a backslash leaves it literal, including
balanced nested blocks:

```handlebars
\{{name}}
\{{#if ready}}yes{{else}}no{{/if}}
```

## Helpers

Helpers are methods on the underlying JSON Logic engine:

```js
const handlebars = new Handlebars()

handlebars.engine.addMethod(
  'addOne',
  ([value]) => value + 1,
  { sync: true, deterministic: true }
)

const render = handlebars.compile('{{addOne age}}')
render({ age: 5 }) // "6"
```

Accurate method metadata allows json-logic-engine to optimize the surrounding
tree. For a helper that accepts one unwrapped argument, its `optimizeUnary`
option can also avoid an argument-array allocation.

The package registers template-oriented helpers and aliases including `each`,
`with`, `match`, `escape`, `json`, `obj`/`object`, `arr`/`array`, `uppercase`,
`lowercase`, `truncate`, `isArray`, and common named arithmetic/comparison
aliases.

## Asynchronous helpers

Use `AsyncHandlebars` when any helper can return a promise:

```js
import { AsyncHandlebars } from 'handlebars-jle'

const handlebars = new AsyncHandlebars()

handlebars.engine.addMethod('fetchUsers', async ([url]) => {
  const response = await fetch(url)
  return response.json()
})

const render = await handlebars.compileAsync(`
{{#each (fetchUsers url)}}
  @{{username}} - {{name}}
{{/each}}
`)

console.log(await render({ url: 'https://example.com/users' }))
```

`compile()` is also available on `AsyncHandlebars`; it returns an async wrapper
that resolves compilation lazily on its first call. `compileAsync()` resolves
the compiled renderer up front and has less steady-state wrapper overhead.

If every helper is synchronous, prefer `Handlebars`.

## Partials

Register partials on an engine instance:

```js
const handlebars = new Handlebars()

handlebars.register('greeting', 'Hello, {{name}}!')
const render = handlebars.compile('{{>greeting name="Ada"}}')

render({}) // "Hello, Ada!"
```

Deterministic partials may be evaluated or inlined by json-logic-engine when the
surrounding data is known. Partials also work in interpreted and asynchronous
modes.

Inline partials use a block instead of Handlebars decorator syntax:

```handlebars
{{#inline "greeting"}}Hello, {{name}}!{{/inline}}
{{>greeting name="Ada"}}
```

Inline partial registration currently belongs to the engine rather than a
lexically isolated template scope. Treat this feature as experimental when
unrelated templates share one engine instance.

## Execution modes

| Class | Option/method | Result |
| --- | --- | --- |
| `Handlebars` | default | Compiled synchronous renderer |
| `Handlebars` | `{ interpreted: true }` | Interpreted synchronous renderer |
| `AsyncHandlebars` | `compile()` | Lazily compiled async renderer |
| `AsyncHandlebars` | `compileAsync()` | Promise of a compiled async renderer |
| `AsyncHandlebars` | `{ interpreted: true }` | Interpreted async renderer |

## Content Security Policy (CSP)

Strict CSP configurations commonly omit `'unsafe-eval'` from `script-src`,
which prevents runtime code generation through `eval` or `new Function`. Use
interpreted mode in those environments:

```js
import { Handlebars } from 'handlebars-jle'

const handlebars = new Handlebars({ interpreted: true })
const render = handlebars.compile('Hello, {{name}}!')

render({ name: 'Ada' })
```

In interpreted mode, `compile()` still parses the template into JSON Logic, but
the returned renderer evaluates that tree with `engine.run()` instead of
generating JavaScript. Registered partials follow the same interpreted path.
Async templates are CSP-compatible as well when the async engine is explicitly
placed in interpreted mode:

```js
import { AsyncHandlebars } from 'handlebars-jle'

const handlebars = new AsyncHandlebars({ interpreted: true })
handlebars.engine.addMethod('awaitableHelper', async ([value]) => value)
const render = handlebars.compile('{{awaitableHelper value}}')

await render({ value: 42 })
```

The default compiled mode uses json-logic-engine's dynamic compiler and
therefore requires a policy that permits runtime code generation.
`AsyncHandlebars` alone does not change that: `compileAsync()` is compiled mode
unless the instance was created with `{ interpreted: true }`.

CSP compatibility is not a sandbox for untrusted templates. A template can
invoke helpers registered on its engine, so applications accepting templates
from untrusted authors should expose only an intentionally restricted helper
set and validate their broader security model separately.

## Compatibility

The commonly used interpolation, triple-brace, helper, subexpression, hash
argument, `if`/`unless`, `else if`, `each`, `with`, partial, block-parameter,
parent traversal, and whitespace-control forms are implemented and covered by
the test suite.

Known differences from Handlebars.js include:

- This package emits JSON Logic rather than the Handlebars compiler AST.
- It intentionally includes additional JSON Logic-oriented helpers and aliases.
- `with` accepts hash arguments as a convenient way to construct a context.
- Inline partials use `{{#inline ...}}` and are currently engine-scoped.
- An ancestor iterator's metadata is addressed as `../@index` rather than
  `@../index`.
- Block parameters use recursive lookup and can inhibit some inline compiler
  optimizations.
- Custom block helpers are json-logic-engine methods; Handlebars.js helper and
  decorator APIs are not drop-in interfaces.

If exact Handlebars.js edge-case compatibility is a requirement, validate the
templates your application uses before migrating.

## Performance

The repository includes a public benchmark suite comparing `handlebars-jle`
with Handlebars.js and Kibana's `kbn-handlebars`. It covers interpolation,
branches, iteration, context traversal, partials, and a substantial YAML
template—not just a single favorable expression.

Selected results from a Node run of one million renders, with each template
compiled once before its render loop:

| Benchmark | Compiled JLE vs Handlebars.js | Interpreted JLE vs Handlebars.js |
| --- | ---: | ---: |
| `SimpleEach` | **30.9× faster** | **8.8× faster** |
| Nested traversal | **26.5× faster** | **9.6× faster** |
| Broad feature example | **21.9× faster** | **3.4× faster** |
| Large YAML template | **28.9× faster** | **4.0× faster** |
| Partials | **92.1× faster** | **5.8× faster** |
| `@first` / `@last` iteration | **37.9× faster** | **5.7× faster** |

The smallest cases can produce much larger ratios because json-logic-engine can
collapse and inline more of the work; they are deliberately omitted from the
highlights above. Async mode is benchmarked too, but its promise overhead makes
it most relevant when a template actually needs asynchronous helpers.

These numbers are highlights from one machine, not portable guarantees. The
relative result varies with the template, data, Node version, and warmup. The
benchmark models the intended usage: compile once and reuse the renderer.

Run the repository benchmarks with:

```sh
npm run bench:parser
cd bench && node --expose-gc index.js
```

Set `BENCH_ITER` to change the default one-million-render sample size.

## Development

The source grammar lives in `parser/handlebars.gram`. The generated parser is
intentionally ignored by Git and recreated before tests and production builds.

```sh
npm install
npm test
npm run build
```

The production bundles include the generated parser runtime and leave
`json-logic-engine` external as the package dependency.

## License

MIT
