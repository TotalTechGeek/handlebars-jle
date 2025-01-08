import { AsyncLogicEngine, Compiler, Constants } from "json-logic-engine";
import { parse } from './parser/parser.min.js'
import { preprocess } from "./preprocessor.js";
import { setupEngine } from "./methods.js";

export const engine = new AsyncLogicEngine();
setupEngine(engine)

/**
 * Registers a partial that can be run with JSON data, uses the logic compiler
 * @param {string} name 
 * @param {*} template 
 * @param {{ noEscape?: boolean, recurse?: boolean, engine?: any }} options 
 */
export function registerPartial (name, template, options = {}) {
    const logic = compileToJSON(template, {...options, methods: engine.methods })
    const selectedEngine = options.engine || engine
    engine.templates[name] = Compiler.build(logic, { engine, avoidInlineAsync: true, extraArguments: 'above' })
    engine.templates[name].deterministic = engine.methods.map.deterministic([null, logic], { engine })
    engine.templates[name].deterministicInline = engine.methods.if.deterministic(logic, { engine: selectedEngine })
    engine.templates[name][Constants.Sync] = engine.methods.map[Constants.Sync](logic, { engine })
} 

/**
 * Registers a partial in interpreted mode that can be run with JSON data
 * Avoids CSP Issues
 * @param {string} name 
 * @param {string} template 
 * @param {{ noEscape?: boolean, recurse?: boolean, engine?: any }} options 
 */
export function registerPartialInterpreted (name, template, options = {}) {
  const logic = compileToJSON(template, options)
  const isSync = engine.methods.map[Constants.Sync](logic, { engine })
  engine.templates[name] = (context, above, engine) => (isSync ? engine.fallback || engine : engine).run(logic, context, { above })
  engine.templates[name][Constants.Sync] = isSync
  engine.templates[name].deterministic = engine.methods.map.deterministic([null, logic], { engine })
  engine.templates[name].deterministicInline = engine.methods.if.deterministic(logic, { engine })
}


/**
 * Compiles a handlebars template string to a function that can be run with JSON data
 * @param {string} str 
 * @param {{ noEscape?: boolean, recurse?: boolean }} options
 * @returns {(data: any) => string}
 */
export function compile (str, options = {}) {
    return engine.fallback.build(compileToJSON(str, { ...options, methods: engine.methods }))
}

/**
 * Compiles a handlebars template string to a function that can be run with JSON data
 * @param {string} str 
 * @param {{ noEscape?: boolean, recurse?: boolean }} options
 * @returns {Promise<(data: any) => Promise<string>>}
 */
export async function compileAsync (str, options = {}) {
    return engine.build(compileToJSON(str, { ...options, methods: engine.methods }))
}


/**
 * Creates a function that can be run with JSON data to get the result of running the logic.
 * Does not use eval; so it can work in environments where eval is disabled.
 * Avoids CSP issues
 * @param {*} logic 
 * @param {{ noEscape?: boolean, recurse?: boolean }} options
 * @returns {(data: any) => string} The result of running the logic with the data
 */
export function interpreted (logic, options = {}, logicEngine = engine.fallback) {
    const parsed = compileToJSON(logic, { ...options, methods: logicEngine.methods })
    return (data) => logicEngine.run(parsed, data)
}

/**
 * Creates a function that can be run with JSON data to get the result of running the logic.
 * Does not use eval; so it can work in environments where eval is disabled.
 * Avoids CSP issues
 * @param {*} logic
 * @param {{ noEscape?: boolean, recurse?: boolean }} options
 * @returns {(data: any) => Promise<string>} The result of running the logic with the data
 */
export function interpretedAsync (logic, options = {}, logicEngine = engine) {
    const parsed = compileToJSON(logic, { ...options, methods: logicEngine.methods })
    return data => logicEngine.run(parsed, data)
}

/**
 * Takes a handlebars template string and returns a JSON Logic object
 * @param {string} str 
 * @param {{ noEscape?: boolean, recurse?: boolean }} options
 * @returns {*} A JSON Logic object representing the handlebars template
 */
export function compileToJSON (str, options = {}) {
  return parse(preprocess(str), options)
}
