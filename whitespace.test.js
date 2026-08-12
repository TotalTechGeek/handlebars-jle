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
