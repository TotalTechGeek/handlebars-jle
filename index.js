import { AsyncLogicEngine, Compiler, Constants } from "json-logic-engine";
import { parse } from './parser/parser.min.js'

export const engine = new AsyncLogicEngine();
engine.fallback.methods = engine.methods
const HashArg = Symbol.for('HashArg');

function each (iterable, func) {
    let res = ''
    if (Array.isArray(iterable)) {
      for (let i = 0; i < iterable.length; i++) res += func(iterable[i], i)
    } else if (typeof iterable === 'object') {
      for (const key in iterable) res += func(iterable[key], key)
    }
    return res
  }
  
  async function eachAsync (iterable, func) {
    let res = ''
    if (Array.isArray(iterable)) {
      for (let i = 0; i < iterable.length; i++) res += await func(iterable[i], i)
    } else if (typeof iterable === 'object') {
      for (const key in iterable) res += await func(iterable[key], key)
    }
    return res
  }
  
  engine.addMethod('each', {
    method: (data, context, above, engine) => {
      const iterable = (engine.fallback || engine).run(data[0], context, above, engine)
      if (!iterable) return ''
      let res = ''
      if (Array.isArray(iterable)) {
        for (let i = 0; i < iterable.length; i++) {
          res += (engine.fallback || engine).run(data[1], iterable[i], { above: [{ index: i }, context, ...above] })
        }
      } else if (typeof iterable === 'object') {
        for (const key in iterable) {
          res += (engine.fallback || engine).run(data[1], iterable[key], { above: [{ index: key }, context, ...above] })
        }
      }
      return res
    },
    asyncMethod: async (data, context, above, engine) => {
      const iterable = await engine.run(data[0], context, above, engine)
      if (!iterable) return ''
      let res = ''
      if (Array.isArray(iterable)) {
        for (let i = 0; i < iterable.length; i++) {
          res += await engine.run(data[1], iterable[i], { above: [{ index: i }, context, ...above] })
        }
      } else if (typeof iterable === 'object') {
        for (const key in iterable) {
          res += await engine.run(data[1], iterable[key], { above: [{ index: key }, context, ...above] })
        }
      }
      return res
    },
    compile: (data, buildState) => {
      const { above = [], state, async } = buildState
      let [selector, mapper] = data
      selector = Compiler.buildString(selector, buildState)
      const mapState = {
        ...buildState,
        state: {},
        above: [{ item: selector }, state, ...above],
        avoidInlineAsync: true,
        iteratorCompile: true
      }
      mapper = Compiler.build(mapper, mapState)
      buildState.useContext = buildState.useContext || mapState.useContext
      buildState.methods.push(mapper)
      buildState.methods.each = each
      buildState.methods.eachAsync = eachAsync
      if (async) {
        if (!Constants.isSync(mapper) || selector.includes('await')) {
          buildState.detectAsync = true
          return `await methods.eachAsync(${selector} || [], methods[${
            buildState.methods.length - 1
          }])`
        }
      }
      return `methods.each(${selector} || [], methods[${
        buildState.methods.length - 1
      }])`
    },
    traverse: false,
    deterministic: engine.methods.map.deterministic
  })

engine.methods['lt'] = engine.methods['<'];
engine.methods['lte'] = engine.methods['<='];
engine.methods['gt'] = engine.methods['>'];
engine.methods['gte'] = engine.methods['>='];
engine.methods['eq'] = engine.methods['=='];
engine.methods['ne'] = engine.methods['!='];

engine.methods['multiply'] = engine.methods['*'];
engine.methods['divide'] = engine.methods['/'];
engine.methods['add'] = engine.methods['+'];
engine.methods['subtract'] = engine.methods['-'];

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

engine.addMethod('lowercase', (args) => args[0].toLowerCase(), { deterministic: true, sync: true });
engine.addMethod('uppercase', (args) => args[0].toUpperCase(), { deterministic: true, sync: true });
engine.addMethod('json', (args) => JSON.stringify(args[0]), { deterministic: true, sync: true });
engine.addMethod('truncate', (args) => args[0].substring(0, args[1]), { deterministic: true, sync: true });
engine.addMethod('arr', (args) => Array.isArray(args) ? args : [args], { deterministic: true, sync: true });

engine.addMethod('with', {
    method: (args, context, above, engine) => {
        const [rArgs, options] = processArgs(args)
        const content = rArgs.pop()

        const optionsLength = Object.keys(options).length
        for (const key in options) options[key] = (engine.fallback || engine).run(options[key], context, { above })
        if (rArgs.length) rArgs[0] = (engine.fallback || engine).run(rArgs[0], context, { above })

        if (optionsLength && rArgs.length) return (engine.fallback || engine).run(content, { ...options, ...rArgs[0] }, { above: [null, context, ...above] })
        if (optionsLength) return (engine.fallback || engine).run(content, options, { above: [null, context, ...above] })
        if (!rArgs.length) return (engine.fallback || engine).run(content, {}, { above: [null, context, ...above] })

        return (engine.fallback || engine).run(content, rArgs[0], { above })
    },
    asyncMethod: async (args, context, above, engine) => {
        const [rArgs, options] = processArgs(args)
        const content = rArgs.pop()

        const optionsLength = Object.keys(options).length
        for (const key in options) options[key] = await engine.run(options[key], context, { above })
        if (rArgs.length) rArgs[0] = await engine.run(rArgs[0], context, { above })

        if (optionsLength && rArgs.length) return engine.run(content, { ...options, ...rArgs[0] }, { above: [null, context, ...above] })
        if (optionsLength) return engine.run(content, options, { above: [null, context, ...above] })
        if (!rArgs.length) return engine.run(content, {}, { above: [null, context, ...above] })

        return engine.run(content, rArgs[0], { above })
    },
    compile: (args, buildState) => {
        const [rArgs, options] = processArgs(args)
        const content = rArgs.pop()

        buildState.methods.push(Compiler.build(content, { ...buildState, asyncDetected: false, avoidInlineAsync: true }))
        const position = buildState.methods.length - 1
        const optionsLength = Object.keys(options).length

        let objectBuild = '   '
        for (const key in options) objectBuild += `${Compiler.buildString(key, buildState)}: ${Compiler.buildString(options[key], buildState)}, `
        objectBuild = '{' + objectBuild.slice(0, -2) + '}'

        const asyncPrefix = !Constants.isSync(buildState.methods[position]) ? 'await ' : ''

        if (optionsLength && rArgs.length) return asyncPrefix + `methods[${position}]({ ...(${Compiler.buildString(rArgs[0], buildState)}), ...${objectBuild} })`
        if (optionsLength) return asyncPrefix + `methods[${position}](${objectBuild})`
        if (!rArgs.length) return asyncPrefix + `methods[${position}]()`
        return asyncPrefix + `methods[${position}](${Compiler.buildString(rArgs[0], buildState)})`
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

engine.addMethod('obj', (args) => {
    const [pArgs, obj] = processArgs(args)
    for (let i = 0; i < pArgs.length; i += 2) obj[pArgs[i]] = pArgs[i+1]
    return obj
}, { deterministic: true, sync: true });

engine.methods.object = engine.methods.obj;
engine.methods.array = engine.methods.arr;


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
        if (arg && arg.preserve?.[HashArg]) { 
          Object.assign(options, arg.preserve);
          assigned = true;
        }
        else if (arg && arg[HashArg]) {
          Object.assign(options, arg);
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
 * @returns {(data: any) => string}
 */
export function compile (str) {
    return engine.fallback.build(compileToJSON(str))
}

/**
 * Compiles a handlebars template string to a function that can be run with JSON data
 * @param {string} str 
 * @returns {(data: any) => Promise<string>}
 */
export async function compileAsync (str) {
    return engine.build(compileToJSON(str))
}


/**
 * Runs the logic synchronously with the data
 * @param {*} logic 
 * @param {*} data 
 * @returns {string} The result of running the logic with the data
 */
export function run (logic, data) {
    return engine.fallback.run(logic, data)
}

/**
 * Runs the logic asynchronously with the data
 * @param {*} logic
 * @param {*} data
 * @returns {Promise<string>} The result of running the logic with the data
 */
export async function runAsync (logic, data) {
    return engine.run(logic, data)
}

const preprocessRegex = /(\S.*)\s*\n\s*({{[^{}]*}})\s*\n/g;
/**
 * Takes a handlebars template string and returns a JSON Logic object
 * @param {string} str 
 * @returns {*} A JSON Logic object representing the handlebars template
 */
export function compileToJSON (str) {
    return parse(str.replace(preprocessRegex, '$1 $2\n'))
}