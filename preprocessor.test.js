import { preprocess } from "./preprocessor.js";

/**
 * @pineapple_define
 */
export function Cases() {
    return {
'MergeIfs': `{{#if a}}
{{#if b}}
{{Hello}}
{{/if}}
{{/if}}`,
'MergeIfOnElse': `
{{#if a}}
{{^}}
{{#if b}}
Hello
{{/if}}
{{/if}}`,
'MergeCloseOnElse': `
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
        {{~/if}}`,

    }
}


/**
 * @test 'Hello {{name}}!' returns 'Hello {{name}}!'
 * @test 'Hello {{~name}}!' returns 'Hello{{name}}!'
 * @test #MergeIfs
 * @test #MergeIfOnElse
 * @test #MergeCloseOnElse
 * @test #BranchTest
 * @test #Elimination
 */
export function execute (str) {
    return preprocess(str)
}