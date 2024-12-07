import { AsyncLogicEngine, Compiler, Constants } from "json-logic-engine";
import { parse } from './parser/parser.min.js'
import { preprocess } from "./preprocessor.js";

export const engine = new AsyncLogicEngine();
engine.fallback.methods = engine.methods
const HashArg = Symbol.for('HashArg');

// Inspired by escape-html
// Also, this can be easily overridden for different escaping requirements
engine.addMethod('escape', (str) => {
  if (Array.isArray(str)) str = str[0]
  if (str === null) return ''
  if (typeof str !== 'string') return str;

  let index = 0
  let shouldEscape = false
  for (; index < str.length; index++) {
    const char = str.charCodeAt(index)
    if (char === 34 || char === 38 || char === 39 || char === 60 || char === 62) {
        shouldEscape = true
        break 
    }
  }
  if (!shouldEscape) return str

  let escape
  let html = ''
  let lastIndex = 0

  for (; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escape = '&quot;'
        break
      case 38: // &
        escape = '&amp;'
        break
      case 39: // '
        escape = '&#39;'
        break
      case 60: // <
        escape = '&lt;'
        break
      case 62: // >
        escape = '&gt;'
        break
      default:
        continue
    }
    if (lastIndex !== index) html += str.substring(lastIndex, index)
    lastIndex = index + 1
    html += escape
  }

  return lastIndex !== index ? html + str.substring(lastIndex, index) : html
}, { deterministic: true, sync: true, optimizeUnary: true });

function each (iterable, func) {
    let res = ''
    if (Array.isArray(iterable)) {
      for (let i = 0; i < iterable.length; i++) res += func(iterable[i], i)
    } 
    // check if iterable is iterable
    else if (iterable && typeof iterable[Symbol.iterator] === 'function') {
      let i = 0
      if (iterable instanceof Map) for (const [key, value] of iterable) res += func(value, key)
      else for (const item of iterable) res += func(item, i++)
    }
    else if (typeof iterable === 'object') {
      for (const key in iterable) res += func(iterable[key], key)
    }
    return res
  }
  
  async function eachAsync (iterable, func) {
    let res = ''
    if (Array.isArray(iterable)) {
      for (let i = 0; i < iterable.length; i++) res += await func(iterable[i], i)
    } else if (iterable && typeof iterable[Symbol.iterator] === 'function') {
      // Todo: Add Async Iterator Support
      let i = 0
      if (iterable instanceof Map) for (const [key, value] of iterable) res += await func(value, key)
      else for (const item of iterable) res += await func(item, i++)
    }
    else if (typeof iterable === 'object') {
      for (const key in iterable) res += await func(iterable[key], key)
    }
    return res
  }
  
/**
 * Function used to help set the "above" context for iterables during
 * interpreted mode. This guy will check the "as" settings and
 * reconfigure what values are assigned to.
 */
function createBlockParamContext (index, value, as) {
  const val = { index, '@index': index }
  if (!as) return val
  if (as.length === 1) val[as[0]] = value
  else if (as.length >= 2) val[as[0]] = value, val[as[1]] = index
  return val 
}

  engine.addMethod('each', {
    method: (preprocessed, context, above, engine) => {
      const [data, options] = processArgs(preprocessed)
      const iterable = engine.run(data[0], context, above, engine)
      if (!iterable) return ''
      let res = ''
      if (Array.isArray(iterable)) {
        for (let i = 0; i < iterable.length; i++) {
          res += engine.run(data[1], iterable[i], { above: [createBlockParamContext(i, iterable[i], options.as), context, above] })
        }
      } else if (iterable && typeof iterable[Symbol.iterator] === 'function') {
        let i = 0
        if (iterable instanceof Map) for (const [key, value] of iterable) res += engine.run(data[1], value, { above: [createBlockParamContext(key, value, options.as), context, above] })
        else for (const item of iterable) res += engine.run(data[1], item, { above: [createBlockParamContext(i++, item, options.as), context, above] })
      } else if (typeof iterable === 'object') {
        for (const key in iterable) {
          res += engine.run(data[1], iterable[key], { above: [createBlockParamContext(key, iterable[key], options.as), context, above] })
        }
      }
      return res
    },
    asyncMethod: async (preprocessed, context, above, engine) => {
      const [data, options] = processArgs(preprocessed)
      const iterable = await engine.run(data[0], context, above, engine)
      if (!iterable) return ''
      let res = ''
      if (Array.isArray(iterable)) {
        for (let i = 0; i < iterable.length; i++) {
          res += await engine.run(data[1], iterable[i], { above: [createBlockParamContext(i, iterable[i], options.as), context, above] })
        }
      } else if (iterable && typeof iterable[Symbol.iterator] === 'function') { 
        // Todo: Add Async Iterator Support
        let i = 0
        if (iterable instanceof Map) for (const [key, value] of iterable) res += await engine.run(data[1], value, { above: [createBlockParamContext(key, value, options.as), context, above] })
        else for (const item of iterable) res += await engine.run(data[1], item, { above: [createBlockParamContext(i++, item, options.as), context, above] })
      } else if (typeof iterable === 'object') {
        for (const key in iterable) {
          res += await engine.run(data[1], iterable[key], { above: [createBlockParamContext(key, iterable[key], options.as), context, above] })
        }
      }
      return res
    },
    compile: (preprocessed, buildState) => {
      const [data, options] = processArgs(preprocessed)
      const { async } = buildState
      let [selector, mapper] = data
      selector = Compiler.buildString(selector, buildState)
      const mapState = {
        ...buildState,
        avoidInlineAsync: true,
        iteratorCompile: true,
        extraArguments: 'index, above'
      }
      mapper = Compiler.build(mapper, mapState)
      buildState.methods.push(mapper)
      buildState.methods.each = each
      buildState.methods.eachAsync = eachAsync

      // Todo: Maybe we can make a utility for this.
      let currentState = '{ "@index": x }'
      if (options.as) {
        if (options.as.length === 1) currentState = `{ "@index": x, ${JSON.stringify(options.as[0])}: i }`
        if (options.as.length >= 2) currentState = `{ "@index": x, ${JSON.stringify(options.as[0])}: i, ${JSON.stringify(options.as[1])}: x }`
      }

      const aboveArray = mapper.aboveDetected ? `[${currentState}, context, above]` : 'null'

      if (async) {
        if (!Constants.isSync(mapper)) {
          buildState.detectAsync = true
          return `await methods.eachAsync(${selector} || [], (i,x) => methods[${
            buildState.methods.length - 1
          }](i, x, ${aboveArray}))`
        }
      }
      return `methods.each(${selector} || [], (i,x) => methods[${
        buildState.methods.length - 1
      }](i, x, ${aboveArray}))`
    },
    traverse: false,
    deterministic: engine.methods.map.deterministic
  })

engine.methods['lt'] = engine.methods['<'];
engine.methods['gt'] = engine.methods['>'];
engine.methods['gte'] = engine.methods['>='];
engine.methods['eq'] = engine.methods['=='];
engine.methods['ne'] = engine.methods['!='];

engine.methods['multiply'] = engine.methods['*'];
engine.methods['divide'] = engine.methods['/'];
engine.methods['add'] = engine.methods['+'];
engine.methods['subtract'] = engine.methods['-'];

engine.methods['lookup'] = engine.methods['get'];

engine.addMethod('isArray', (args) => Array.isArray(args[0]), { deterministic: true, sync: true });
engine.addMethod('type', (args) => typeof args[0], { deterministic: true, sync: true });
engine.addMethod('log', ([value]) => { console.log(value); return value }, { deterministic: true, sync: true });
engine.addMethod('max', (args) => Math.max(...args), { deterministic: true, sync: true });
engine.addMethod('min', (args) => Math.min(...args), { deterministic: true, sync: true });

engine.addMethod('default', {
    method: (args) => args[0] ?? args[1],
    compile: (args, buildState) => {
        if (!Array.isArray(args)) return false
        let res = Compiler.buildString(args[0], buildState)
        for (let i = 1; i < args.length; i++) res += ' ?? ' + Compiler.buildString(args[i], buildState)
        return '(' + res + ')';
    },
    traverse: true,
    deterministic: true
});

engine.addMethod('lowercase', (args) => Array.isArray(args) ? args[0].toLowerCase() : args.toLowerCase(), { deterministic: true, sync: true, optimizeUnary: true });
engine.addMethod('uppercase', (args) => args[0].toUpperCase(), { deterministic: true, sync: true });
engine.addMethod('json', (args) => JSON.stringify(args[0]), { deterministic: true, sync: true });
engine.addMethod('truncate', (args) => args[0].substring(0, args[1]), { deterministic: true, sync: true });
engine.addMethod('arr', (args) => Array.isArray(args) ? args : [args], { deterministic: true, sync: true });

engine.addMethod('with', {
    method: (args, context, above, engine) => {
        const [rArgs, options] = processArgs(args)
        const content = rArgs.pop()

        const optionsLength = Object.keys(options).length
        for (const key in options) options[key] = engine.run(options[key], context, { above })

        if (rArgs.length) rArgs[0] = engine.run(rArgs[0], context, { above })

        let item 
        if (optionsLength && rArgs.length) item = { ...options, ...rArgs[0] }
        else if (optionsLength) item = options
        else if (!rArgs.length) item = {}
        if (item) return engine.run(content, item, { above: [createBlockParamContext(null, item, options.as), context, above] })

        return engine.run(content, rArgs[0], { above })
    },
    asyncMethod: async (args, context, above, engine) => {
        const [rArgs, options] = processArgs(args)
        const content = rArgs.pop()

        const optionsLength = Object.keys(options).length
        for (const key in options) options[key] = await engine.run(options[key], context, { above })
        if (rArgs.length) rArgs[0] = await engine.run(rArgs[0], context, { above })

        let item 
        if (optionsLength && rArgs.length) item = { ...options, ...rArgs[0] }
        else if (optionsLength) item = options
        else if (!rArgs.length) item = {}
        if (item) return engine.run(content, item, { above: [createBlockParamContext(null, item, options.as), context, above] })

        return engine.run(content, rArgs[0], { above })
    },
    compile: (args, buildState) => {
        const [rArgs, options] = processArgs(args)
        const content = rArgs.pop()
        
        buildState.methods.push(Compiler.build(content, { ...buildState, asyncDetected: false, avoidInlineAsync: true, extraArguments: 'above' }))
        const position = buildState.methods.length - 1
        const optionsLength = Object.keys(options).length

        let objectBuild = '   '
        for (const key in options) objectBuild += `${Compiler.buildString(key, buildState)}: ${Compiler.buildString(options[key], buildState)}, `
        objectBuild = '{' + objectBuild.slice(0, -2) + '}'

        const asyncPrefix = !Constants.isSync(buildState.methods[position]) ? 'await ' : ''

        function makeContext (val) {
            if (!options.as) return 
            if (options.as.length === 1) return `{ ${JSON.stringify(options.as[0])}: ${val} }`
        }

        if (optionsLength && rArgs.length) return asyncPrefix + `methods[${position}]({ ...(${Compiler.buildString(rArgs[0], buildState)}), ...${objectBuild} }, [${makeContext(`{ ...(${Compiler.buildString(rArgs[0], buildState)}), ...${objectBuild} }`)}, context, above])`
        if (optionsLength) return asyncPrefix + `methods[${position}](${objectBuild}, [${makeContext(objectBuild)}, context, above])`
        if (!rArgs.length) return asyncPrefix + `methods[${position}](null, [null, context, above])`
        return asyncPrefix + `methods[${position}](${Compiler.buildString(rArgs[0], buildState)}, above)`
    },
    traverse: false,
    deterministic: (data, buildState) => {
        const check = buildState.engine.methods.if.deterministic
        const [rArgs, options] = processArgs(data)
        const content = rArgs.pop()
        return check([Object.values(options), rArgs], buildState) && check(content, { ...buildState, insideIterator: true })
    }
})

engine.addMethod('match', (args) => {
    const value = args[0]
    const [pArgs, options] = processArgs(args.slice(1))
    if (options[value]) return options[value]
    for (let i = 0; i < pArgs.length; i += 2) if (value === pArgs[i]) return pArgs[i+1]
    return pArgs[pArgs.length - 1]
}, { deterministic: true, sync: true });

engine.addMethod('merge', (args) => Object.assign({}, ...args), { deterministic: true, sync: true });
engine.addMethod('%HashArg', ([key, value]) => ({ [key]: value, [HashArg]: true }), { sync: true, deterministic: true });

engine.addMethod('obj', {
  method: (args, context, above, engine) => {
      const [pArgs, obj] = processArgs(args)
      for (let i = 0; i < pArgs.length; i += 2) obj[pArgs[i]] = pArgs[i+1]
      return obj
  },
  traverse: true, 
  compile: (data, buildState) => {
    let res = buildState.compile`{`
    const [pArgs, obj] = processArgs(data)
    
    let first = true
    for (const key in obj) {
      res = buildState.compile`${res}${first ? buildState.compile`` : buildState.compile`,`} ${key}: ${obj[key]}`
      first = false
    }

    for (let i = 0; i < pArgs.length; i += 2) {
      res = buildState.compile`${res}${first ? buildState.compile`` : buildState.compile`,`} ${pArgs[i]}: ${pArgs[i+1]}`
      first = false
    }
    
    return buildState.compile`${res} }`
  },
  deterministic: true
});

engine.methods.object = engine.methods.obj;
engine.methods.array = engine.methods.arr;

// recursive variable lookup -- takes a perf hit; cannot be optimized
engine.addMethod('rvar', {
    method: (name, context, above, engine) => {
      if (Array.isArray(name)) name = name[0]
      name = name.replace(/\.\.\//g, '').replace(/\.\//g, '')
      const parts = name.split('.')
      const firstPart = parts.shift()
      const path = parts.join('.')
      if (name === '') return context
      if (context && context[firstPart]) return path ? engine.methods.get.method([context[firstPart], path]) : context[firstPart]
      for (let i = 0; i < above.length; i++) {
        if (above[i] && typeof above[i][firstPart] !== 'undefined') return path ? engine.methods.get.method([above[i][firstPart], path], context, above, engine) : above[i][firstPart]
        if (i === above.length -1 && Array.isArray(above[i])) {
          above = above[i]
          i = -1
        }
      }
      return null
  }
}, { deterministic: false, sync: true, optimizeUnary: true })


const templates = {}
engine.addMethod('%partial', {
    method: (args, context, above, engine) => {
        const path = args[0]
        const options = processArgs(args, true)[1]
        if (!templates[path]) throw new Error(`Template ${path} not found`)
        if (options) for (const key in options) options[key] = engine.run(options[key], context, { above })
        if (options?.['']) return templates[path](options[''], [null, context, above], engine)
        else if (options) return templates[path](options, [null, context, above], engine)        
        return templates[path](context, [null, context, above], engine)
    },
    asyncMethod: async (args, context, above, engine) => {
        const path = args[0]
        const options = processArgs(args, true)[1]
        if (!templates[path]) throw new Error(`Template ${path} not found`)
        if (options) for (const key in options) options[key] = await engine.run(options[key], context, { above })
        if (options?.['']) return templates[path](options[''], [null, context, above], engine)
        else if (options) return templates[path](options, [null, context, above], engine)
        return templates[path](context, [null, context, above], engine)
    },
    traverse: true,
    deterministic: (data, buildState) => {
        const check = buildState.engine.methods.map.deterministic
        const [rArgs, options] = processArgs(data, true)
        if (!options) return check([rArgs], buildState) && templates[rArgs[0]] && templates[rArgs[0]].deterministicInline
        return check([Object.values(options), rArgs], buildState) && templates[rArgs[0]] && templates[rArgs[0]].deterministic
    },
    compile: (data, buildState) => {
        const path = data[0]
        const options = processArgs (data, true)[1]
    
        if (options?.['']) return buildState.compile`${templates[path]}(${options['']}, [null, context, above], engine)`

        if (options) {
            let res = buildState.compile`{`
            let first = true
            for (const key in options) {
                res = buildState.compile`${res}${first ? buildState.compile`` : buildState.compile`,`} ${key}: ${options[key]}`
                first = false
            }
            res = buildState.compile`${res} }`
            return buildState.compile`${templates[path]}(${res}, [null, context, above], engine)`
        }
        
        return false
    }
})

// Warning: This guy isn't scoped to the template; so registering in one template will register in all
// This can allow for mangling.
engine.addMethod('inline', {
    method: (args, context, above, engine) => {
        const name = args[0]
        if (templates[name]) return ''
        const content = args[args.length - 1]
        templates[name] = (context, above, engine) => engine.run(content, context, { above })
        templates[name].deterministic = engine.methods.map.deterministic([null, content], { engine })
        return ''
    },
    traverse: false,
    compile: (data, buildState) => {
        const content = data[data.length - 1]
        templates[data[0]] = Compiler.build(content, { ...buildState, avoidInlineAsync: true, extraArguments: 'above' })
        templates[data[0]].deterministic = buildState.engine.methods.map.deterministic([null, content], buildState)
        return '""'
    }
}, { sync: true })


/**
 * Registers a partial that can be run with JSON data, uses the logic compiler
 * @param {string} name 
 * @param {*} template 
 * @param {{ noEscape?: boolean, recurse?: boolean, engine?: any }} options 
 */
export function registerPartial (name, template, options = {}) {
    const logic = compileToJSON(template, {...options, methods: engine.methods })
    const selectedEngine = options.engine || engine
    templates[name] = Compiler.build(logic, { engine, avoidInlineAsync: true, extraArguments: 'above' })
    templates[name].deterministic = engine.methods.map.deterministic([null, logic], { engine })
    templates[name].deterministicInline = engine.methods.if.deterministic(logic, { engine: selectedEngine })
    templates[name][Constants.Sync] = engine.methods.map[Constants.Sync](logic, { engine })
} 

/**
 * Registers a partial in interpreted mode that can be run with JSON data
 * Avoids CSP Issues
 * @param {string} name 
 * @param {string} template 
 * @param {{ noEscape?: boolean, recurse?: boolean, engine?: any }} options 
 */
export function registerPartialInterpreted (name, template, options) {
  const logic = compileToJSON(template, options)
  const isSync = engine.methods.map[Constants.Sync](logic, { engine })
  templates[name] = (context, above, engine) => (isSync ? engine.fallback || engine : engine).run(logic, context, { above })
  templates[name][Constants.Sync] = isSync
  templates[name].deterministic = engine.methods.map.deterministic([null, logic], { engine })
  templates[name].deterministicInline = engine.methods.if.deterministic(logic, { engine })
}

/**
 * Extracts hash arguments from the arguments array and simplifies it into an object,
 * returning the simplified arguments array and the hash arguments object
 * @param {any[]} args 
 * @returns {[Record<string, any>, any[]]}
 */
export function processArgs (args, nullIfEmpty = false) {
    const rArgs = []
    let options = {} 
    let assigned = false
    for (const arg of args) {
        if (arg && arg[HashArg]) {
          if (arg['%HashArg']) options[arg['%HashArg'][0]] = arg['%HashArg'][1]
          else Object.assign(options, arg)
          assigned = true;
        }
        else rArgs.push(arg);
    }
    if (nullIfEmpty && !assigned) options = null
    return [rArgs, options];
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
 * @returns {(data: any) => Promise<string>}
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