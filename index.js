import { AsyncLogicEngine, LogicEngine, Compiler, Constants } from "json-logic-engine";
import { parse } from './parser/parser.min.js'
import { preprocess } from "./preprocessor.js";
import { setupEngine } from "./methods.js";

/**
 * Internal function to register a partial with the engine.
 * @param {string} name 
 * @param {string} script 
 * @param {{ noEscape?: boolean, recurse?: boolean }} options 
 * @param {LogicEngine | AsyncLogicEngine} engine 
 * @param {boolean} interpreted 
 */
function registerPartial (name, script, options, engine, interpreted) {
  if (interpreted) {
    const logic = compileToJSON(script, options)
    const isSync = engine.methods.map[Constants.Sync](logic, { engine })
    engine.templates[name] = (context, above, engine) => (isSync ? engine.fallback || engine : engine).run(logic, context, { above })
    engine.templates[name][Constants.Sync] = isSync
    engine.templates[name].deterministic = engine.methods.map.deterministic([null, logic], { engine })
    engine.templates[name].deterministicInline = engine.methods.if.deterministic(logic, { engine })
    return
  }
  const logic = compileToJSON(script, {...options, methods: engine.methods })
  engine.templates[name] = Compiler.build(logic, { engine, avoidInlineAsync: true, extraArguments: 'above' })
  engine.templates[name].deterministic = engine.methods.map.deterministic([null, logic], { engine })
  engine.templates[name].deterministicInline = engine.methods.if.deterministic(logic, { engine })
  engine.templates[name][Constants.Sync] = engine.methods.map[Constants.Sync](logic, { engine })
}



export class Handlebars {
  constructor ({ interpreted = false } = {}) {
    this.engine = setupEngine(new LogicEngine())
    this.interpreted = interpreted
  }

  /**
   * 
   * @param {string} script 
   * @param {{ noEscape?: boolean, recurse?: boolean }} options 
   * @returns {(data: any) => string}
   */
  compile (script, options) {
    const logic = compileToJSON(script, { ...options, methods: this.engine.methods })
    if (this.interpreted) return (data) => this.engine.run(logic, data)
    return this.engine.build(logic)
  }

  /**
   * Registers a partial that can be run with JSON data, uses the logic compiler
   * @param {string} name 
   * @param {string} script 
   * @param {{ noEscape?: boolean, recurse?: boolean }} options 
   */
  register (name, script, options) {
    registerPartial(name, script, options, this.engine, this.interpreted)
  }
}

export class AsyncHandlebars {
  constructor ({ interpreted = false } = {}) {
    this.engine = setupEngine(new AsyncLogicEngine())
    this.interpreted = interpreted
  }

  /**
   * Compiles a handlebars template string to a function that can be run with JSON data
   * @param {string} str 
   * @param {{ noEscape?: boolean, recurse?: boolean }} options
   * @returns {(data: any) => Promise<string>}
   */
  compile (script, options) {
    const logic = compileToJSON(script, { ...options, methods: this.engine.methods })
    if (this.interpreted) return (data) => this.engine.run(logic, data)
    let method = this.engine.build(logic)
    return async (data) => (await method)(data)
  }



  /**
   * Registers a partial that can be run with JSON data, uses the logic compiler
   * @param {string} name 
   * @param {string} script 
   * @param {{ noEscape?: boolean, recurse?: boolean }} options 
   */
  register (name, script, options) {
    registerPartial(name, script, options, this.engine, this.interpreted)
  }
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
