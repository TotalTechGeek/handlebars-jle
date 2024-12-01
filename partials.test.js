
import { registerPartialInterpreted, registerPartial, compile, compileAsync, interpretedAsync, interpreted } from './index.js'


registerPartial('Static', 'Hello, World!')
registerPartialInterpreted('StaticInterpreted', 'Hello, World!')

registerPartial('Hello', 'Hello, {{name}}!')
registerPartialInterpreted('HelloInterpreted', 'Hello, {{name}}!')


/**
 * @param {string} script 
 * @test '{{>Static}}' returns 'Hello, World!'
 * @test '{{>Static inline=true}}' returns 'Hello, World!'
 * @test '{{>StaticInterpreted}}' returns 'Hello, World!'
 * @test '{{>StaticInterpreted inline=true}}' returns 'Hello, World!'
 * @test '{{#inline "Yay"}}Yay{{/inline}}{{>Yay}}' returns 'Yay'
 * @test '{{>Hello name="Jesse"}}' returns 'Hello, Jesse!'
 * @test '{{>Hello name=.}}', 'John' returns 'Hello, John!'
 * @test '{{>HelloInterpreted name="Jesse"}}' returns 'Hello, Jesse!'
 * @test '{{>HelloInterpreted name=.}}', 'John' returns 'Hello, John!'
 */
export function Run(script, data) {
    return compile(script, { recurse: false })(data)
}


/**
 * @param {string} script 
 * @test '{{>Static}}' resolves 'Hello, World!'
 * @test '{{>Static inline=true}}' resolves 'Hello, World!'
 * @test '{{>StaticInterpreted}}' resolves 'Hello, World!'
 * @test '{{>StaticInterpreted inline=true}}' resolves 'Hello, World!'
 * @test '{{#inline "Yay"}}Yay{{/inline}}{{>Yay}}' resolves 'Yay'
 * @test '{{>HelloInterpreted name="Jesse"}}' resolves 'Hello, Jesse!'
 * @test '{{>HelloInterpreted name=.}}', 'John' resolves 'Hello, John!'
 */
export async function RunAsync(script, data) {
    return (await compileAsync(script, { recurse: false }))(data)
}


/**
 * @param {string} script 
 * @test '{{>Static}}' returns true
 * @test '{{>StaticInterpreted}}' returns true
 * @test '{{#inline "Yay"}}Yay{{/inline}}{{>Yay}}' returns true
 * @test '{{>Hello name="Jesse"}}' returns true
 * @test '{{>Hello name=.}}', 'John' returns true
 */
export function RunMethodMatch(script, data) {
    return interpreted(script, { recurse: false })(data) === Run(script, data)
}


/**
 * @param {string} script 
 * @test '{{>Static}}' resolves true
 * @test '{{>StaticInterpreted}}' resolves true
 * @test '{{#inline "Yay"}}Yay{{/inline}}{{>Yay}}' resolves true
 * @test '{{>HelloInterpreted name="Jesse"}}' resolves true
 * @test '{{>HelloInterpreted name=.}}', 'John' resolves true
 */
export async function RunMethodAsyncMatch(script, data) {
    return (await interpretedAsync(script, { recurse: false })(data)) === (await RunAsync(script, data))
}
