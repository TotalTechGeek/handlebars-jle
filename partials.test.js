
import { AsyncHandlebars, Handlebars } from './index.js'

const hbs = new Handlebars()
const hbsAsync = new AsyncHandlebars()
const hbsInterpreted = new Handlebars({ interpreted: true })
const hbsAsyncInterpreted = new AsyncHandlebars({ interpreted: true })

for (const engine of [hbs, hbsAsync, hbsInterpreted, hbsAsyncInterpreted]) {
    engine.register('Static', 'Hello, World!')
    engine.register('Hello', 'Hello, {{name}}!')
    engine.register('StaticInterpreted', 'Hello, World!')
    engine.register('HelloInterpreted', 'Hello, {{name}}!')
}

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
    return hbs.compile(script, { recurse: false })(data)
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
    return hbsAsync.compile(script, { recurse: false })(data)
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
    const f = hbs.compile(script, { recurse: false })
    const g = hbsInterpreted.compile(script, { recurse: false })
    return f(data) === g(data)
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
    const f = hbsAsync.compile(script, { recurse: false })
    const g = hbsAsyncInterpreted.compile(script, { recurse: false })
    return await f(data) === await g(data)
}
