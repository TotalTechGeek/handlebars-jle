import { Handlebars } from './index.js'

const handlebars = new Handlebars()

/**
 * @pineapple_define
 */
export function Cases () {
  return {
    MergeIfs: `{{#if a}}
{{#if b}}
{{Hello}}
{{/if}}
{{/if}}`,
    MergeIfOnElse: `
{{#if a}}
{{^}}
{{#if b}}
Hello
{{/if}}
{{/if}}`,
    MergeCloseOnElse: `
{{#if a}}
Hi
{{^}}
{{/if}}`,
    BranchTest: `{{#if a}}
a
{{else if b}}
b
{{else if c}}
c
{{~else if d}}
d
{{else if e}}
e
{{else if f}}
f
{{else if g}}
g
{{/if}}`,
    Elimination: `{{#if a~}}




          Hi
        {{~/if}}`
  }
}

/**
 * @param {string} source
 * @param {object} [data]
 * @test 'Hello   {{~name}}!', { name: 'John' } returns 'HelloJohn!'
 * @test 'Hello {{name~}}   !', { name: 'John' } returns 'Hello John!'
 * @test #MergeIfs, { a: true, b: true, Hello: 'Hello' } returns 'Hello\n'
 * @test #MergeIfOnElse, { a: true, b: true } returns '\n'
 * @test #MergeCloseOnElse, { a: true } returns '\nHi\n'
 * @test #BranchTest, { b: true } returns 'b\n'
 * @test #Elimination, { a: true } returns 'Hi'
 */
export function render (source, data = {}) {
  return handlebars.compile(source)(data)
}

/**
 * Long runs of whitespace (spaces, tabs or newlines) used to parse in quadratic time (about 19s for 100k), which
 * lets anyone who controls a template stall the event loop. Parsing must stay near-linear.
 * @param {string} fill The repeated whitespace
 * @param {number} count
 * @param {string} tail Template text after the whitespace
 * @test ' ', 100000, '{{x}}' returns true
 * @test '\t', 100000, '{{x}}' returns true
 * @test '\n', 100000, '{{x}}' returns true
 * @test '\r\n', 50000, '{{x}}' returns true
 * @test '\n        ', 12000, '{{x}}' returns true
 * @test '   \n', 25000, '{{x}}' returns true
 */
export function parsesQuickly (fill, count, tail) {
  const start = performance.now()
  handlebars.compile('a' + fill.repeat(count) + tail)
  return performance.now() - start < 1000
}

/**
 * The long-run optimization must still trim before `{{~` and keep whitespace otherwise.
 * Renders `a + fill x count + tail`, with each run of spaces in the output shown as <length>.
 * @param {string} fill
 * @param {number} count
 * @param {string} tail
 * @param {object} [data]
 * @test ' ', 5000, '{{~x}}', { x: 'X' } returns 'aX'
 * @test ' ', 5000, '{{x}}', { x: 'X' } returns 'a<5000>X'
 * @test ' ', 5000, '{{x~}}   b', { x: 'X' } returns 'a<5000>Xb'
 * @test ' ', 5000, '{{~x~}}   b', { x: 'X' } returns 'aXb'
 * @test ' ', 5000, '   {{~x}}', { x: 'X' } returns 'aX'
 * @test ' ', 5000, '{{#if x}}   y   {{/if}} b', { x: true } returns 'a<5003>y<4>b'
 * @test ' ', 5000, '\n  {{#if x}}\ny\n  {{/if}}\nb', { x: true } returns 'a<5000>\ny\nb'
 */
export function renderLong (fill, count, tail, data = {}) {
  return handlebars.compile('a' + fill.repeat(count) + tail)(data).replace(/ +/g, run => `<${run.length}>`)
}
