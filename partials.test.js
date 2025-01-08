
import { AsyncHandlebars, Handlebars } from './index.js'

const hbs = new Handlebars()
const hbsAsync = new AsyncHandlebars()

hbsAsync.interpreted = false
hbs.interpreted = false
hbsAsync.register('Static', 'Hello, World!')
hbsAsync.register('Hello', 'Hello, {{name}}!')
hbs.register('Static', 'Hello, World!')
hbs.register('Hello', 'Hello, {{name}}!')

hbsAsync.interpreted = true
hbs.interpreted = true
hbsAsync.register('StaticInterpreted', 'Hello, World!')
hbsAsync.register('HelloInterpreted', 'Hello, {{name}}!')
hbs.register('StaticInterpreted', 'Hello, World!')
hbs.register('HelloInterpreted', 'Hello, {{name}}!')


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
    hbs.interpreted = false
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
    hbsAsync.interpreted = false
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
    hbs.interpreted = true 
    const f = hbs.compile(script, { recurse: false })

    hbs.interpreted = false
    const g = hbs.compile(script, { recurse: false })

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
    hbsAsync.interpreted = true
    const f = hbsAsync.compile(script, { recurse: false })

    hbsAsync.interpreted = false
    const g = hbsAsync.compile(script, { recurse: false })

    return await f(data) === await g(data)
}
