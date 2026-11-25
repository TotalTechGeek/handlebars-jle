import { Compiler, Constants } from "json-logic-engine";
const HashArg = Symbol.for('HashArg');
const hasOwn = Object.prototype.hasOwnProperty;


/**
* Overrides the truthiness check of the engine.
* @param {*} value
* @returns
*/
function truthy (value) {
  if (!value) return value
  // The following check could be erased, as it'd be caught by the iterator check,
  // but it's here for performance reasons.
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') {
    if (value[Symbol.iterator]) {
      if ('length' in value && value.length === 0) return false
      if ('size' in value && value.size === 0) return false
    }
    // Objects are considered truthy regardless in Handlebars
    // if (value.constructor.name === 'Object') return Object.keys(value).length > 0
  }
  return value
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
 * Function used to help set the "above" context for iterables during
 * interpreted mode. This guy will check the "as" settings and
 * reconfigure what values are assigned to.
 */
function createBlockParamContext (index, value, as, length, position = index) {
    const val = { index, length, position }
    if (!as) return val
    if (as.length === 1) val[as[0]] = value
    else if (as.length >= 2) val[as[0]] = value, val[as[1]] = index
    return val
}

/**
 * Calls `func(value, key, length, position)` for each item. `key` is the array
 * index or object key (`@key`), `position` is always numeric (`@index`).
 */
function each (iterable, func) {
    // Like Handlebars, only arrays and objects iterate; a string's characters do not.
    if (!iterable || typeof iterable !== 'object') return ''
    let res = ''
    if (Array.isArray(iterable)) {
      const len = iterable.length
      for (let i = 0; i < len; i++) res += func(iterable[i], i, len, i)
    }
    // check if iterable is iterable
    else if (iterable && typeof iterable[Symbol.iterator] === 'function') {
      let i = 0
      const len = iterable.size ?? iterable.length
      if (iterable instanceof Map) for (const [key, value] of iterable) res += func(value, key, len, i++)
      else for (const item of iterable) res += func(item, i, len, i++)
    }
    else if (iterable && typeof iterable === 'object') {
      const keys = Object.keys(iterable)
      const len = keys.length
      for (let i = 0; i < len; i++) res += func(iterable[keys[i]], keys[i], len, i)
    }
    return res
}

async function eachAsync (iterable, func) {
  if (!iterable || typeof iterable !== 'object') return ''
  let res = ''
  if (Array.isArray(iterable)) {
    const len = iterable.length
    for (let i = 0; i < len; i++) res += await func(iterable[i], i, len, i)
  } else if (iterable && typeof iterable[Symbol.iterator] === 'function') {
    // Todo: Add Async Iterator Support
    let i = 0
    const len = iterable.size ?? iterable.length
    if (iterable instanceof Map) for (const [key, value] of iterable) res += await func(value, key, len, i++)
    else for (const item of iterable) res += await func(item, i, len, i++)
  }
  else if (iterable && typeof iterable === 'object') {
    const keys = Object.keys(iterable)
    const len = keys.length
    for (let i = 0; i < len; i++) res += await func(iterable[keys[i]], keys[i], len, i)
  }
  return res
}

/** Whether `each` would iterate at least once; decides `{{#each}}…{{else}}`. */
function hasItems (value) {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') {
    if (typeof value[Symbol.iterator] === 'function') {
      if ('length' in value) return value.length > 0
      if ('size' in value) return value.size > 0
      for (const _ of value) return true
      return false
    }
    for (const _ in value) return true
    return false
  }
  return true
}

/**
 * Handlebars' test for `{{#with}}` (and its `{{else}}`): null, undefined, false,
 * '' and empty arrays are empty; 0 is not.
 */
function isEmpty (value) {
  if (!value && value !== 0) return true
  return Array.isArray(value) && value.length === 0
}

/** `{{#with value}}`: the body with `value` as its context, or nothing when it is empty. */
function withValue (value, body, scope) {
  return isEmpty(value) ? '' : body(value, scope)
}

/** Walks the scope chain to the outermost context, for `@root`. */
function rootOf (context, above) {
  let root = context
  while (Array.isArray(above) && above.length >= 2) {
    root = above[1]
    above = above[2]
  }
  return root
}

/**
 * The top-level keys a template reads from its own context, or null when that
 * cannot be known statically (`this`, scope climbing, recursive lookups, ...).
 */
function contextReads (logic, keys = new Set()) {
  if (!keys) return null
  if (Array.isArray(logic)) {
    for (const item of logic) if (!contextReads(item, keys)) return null
    return keys
  }
  if (!logic || typeof logic !== 'object') return keys
  for (const op in logic) {
    const args = logic[op]
    if (op === 'val') {
      const path = Array.isArray(args) && args.length === 1 && !Array.isArray(args[0]) ? args[0] : args
      if (typeof path === 'string' || typeof path === 'number') keys.add(String(path))
      else if (Array.isArray(path) && path.length && (typeof path[0] === 'string' || typeof path[0] === 'number')) keys.add(String(path[0]))
      else return null
      continue
    }
    if (op === 'rvar' || op === '%root' || op === '%partial' || op === '%partialBlock' || op === '%partialBlockContent' ||
      op === '%partialScoped' || op === '%partialBlockScoped' || op === '%inlineScope' || op === 'inline') return null
    if (!contextReads(args, keys)) return null
  }
  return keys
}

export { contextReads }


/**
 * Setup the logic engine
 * @template {import('json-logic-engine').LogicEngine | import('json-logic-engine').AsyncLogicEngine} T
 * @param {T} engine
 * @returns T
 */
export function setupEngine (engine) {
    const templates = {}

    engine.truthy = truthy
    engine.templates = templates
    if (engine.fallback) {
        engine.fallback.templates = templates
        engine.fallback.methods = engine.methods
        engine.fallback.truthy = truthy
    }

    // Inspired by escape-html
    // Also, this can be easily overridden for different escaping requirements
    engine.addMethod('escape', (str) => {
        if (str === null || str === undefined) return ''
        if (typeof str !== 'string') {
          if (Array.isArray(str)) str = String(str)
          else return str
        }

        let index = 0
        let shouldEscape = false
        for (; index < str.length; index++) {
        const char = str.charCodeAt(index)
        if (char === 34 || char === 38 || char === 39 || char === 60 || char === 61 || char === 62 || char === 96) {
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
            escape = '&#x27;'
            break
            case 61: // =
            escape = '&#x3D;'
            break
            case 96: // `
            escape = '&#x60;'
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

  /**
    * Mechanism for swapping out the context for interpreted each loops
    */
  function swapContext (struct, iterable, i, as, length = iterable.length, position = i, value = iterable[i]) {
    struct.above[0] = createBlockParamContext(i, value, as, length, position)
    return struct
  }


  engine.addMethod('each', {
    method: (preprocessed, context, above, engine) => {
      const [data, options] = processArgs(preprocessed)
      const iterable = engine.run(data[0], context, { above })
      if (!iterable || typeof iterable !== 'object') return ''
      let res = ''
      const struct = { above: [null, context, above] }
      // Todo: This only works on the second time a template is used.
      const optimizedFn = engine.optimizedMap.get(data[1])
      if (Array.isArray(iterable)) {
        let i = 0
        if (optimizedFn && typeof optimizedFn === 'function') for (; i < iterable.length; i++) res += optimizedFn(iterable[i], swapContext(struct, iterable, i, options.as).above)
        else for (; i < iterable.length; i++) res += engine.run(data[1], iterable[i], swapContext(struct, iterable, i, options.as))
      } else if (iterable && typeof iterable[Symbol.iterator] === 'function') {
        let i = 0
        const len = iterable.size ?? iterable.length
        if (iterable instanceof Map) for (const [key, value] of iterable) res += engine.run(data[1], value, swapContext(struct, iterable, key, options.as, len, i++, value))
        else for (const item of iterable) res += engine.run(data[1], item, swapContext(struct, iterable, i, options.as, len, i++, item))
      } else if (typeof iterable === 'object') {
        const keys = Object.keys(iterable)
        const len = keys.length
        if (optimizedFn && typeof optimizedFn === 'function') for (let i = 0; i < len; i++) res += optimizedFn(iterable[keys[i]], swapContext(struct, iterable, keys[i], options.as, len, i).above)
        else for (let i = 0; i < len; i++) res += engine.run(data[1], iterable[keys[i]], swapContext(struct, iterable, keys[i], options.as, len, i))
      }
      return res
    },
    asyncMethod: async (preprocessed, context, above, engine) => {
      const [data, options] = processArgs(preprocessed)
      const iterable = await engine.run(data[0], context, { above })
      if (!iterable || typeof iterable !== 'object') return ''
      let res = ''
      const struct = { above: [null, context, above] }
      if (Array.isArray(iterable)) {
        for (let i = 0; i < iterable.length; i++) res += await engine.run(data[1], iterable[i], swapContext(struct, iterable, i, options.as))
      } else if (iterable && typeof iterable[Symbol.iterator] === 'function') {
        // Todo: Add Async Iterator Support
        let i = 0
        const len = iterable.size ?? iterable.length
        if (iterable instanceof Map) for (const [key, value] of iterable) res += await engine.run(data[1], value, swapContext(struct, iterable, key, options.as, len, i++, value))
        else for (const item of iterable) res += await engine.run(data[1], item, swapContext(struct, iterable, i, options.as, len, i++, item))
      } else if (typeof iterable === 'object') {
        const keys = Object.keys(iterable)
        const len = keys.length
        for (let i = 0; i < len; i++) res += await engine.run(data[1], iterable[keys[i]], swapContext(struct, iterable, keys[i], options.as, len, i))
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
        extraArguments: 'index, above, length, position'
      }
      mapper = Compiler.build(mapper, mapState)
      buildState.methods.push(mapper)
      buildState.methods.each = each
      buildState.methods.eachAsync = eachAsync

      // Todo: Maybe we can make a utility for this.
      let currentState = '{ "index": x, "length": l, "position": p }'
      if (options.as) {
        if (options.as.length === 1) currentState = `{ "index": x, "length": l, "position": p, ${JSON.stringify(options.as[0])}: i }`
        if (options.as.length >= 2) currentState = `{ "index": x, "length": l, "position": p, ${JSON.stringify(options.as[0])}: i, ${JSON.stringify(options.as[1])}: x }`
      }


      const aboveArray = mapper.aboveDetected ? `[${currentState}, context, above]` : 'null'

      if (async) {
        if (!Constants.isSync(mapper)) {
          buildState.detectAsync = true
          return `await methods.eachAsync(${selector} || [], (i,x,l,p) => methods[${
            buildState.methods.length - 1
          }](i, x, ${aboveArray}, l, p))`
        }
      }

      if (!mapper.aboveDetected) {
        const size = 4
        // let's build out branches up to 5, then fallback to each
        let res = `(!Array.isArray(prev = ${selector} || []) || prev.length > ${size} ? methods.each(prev, (i,x,l,p) => methods[${buildState.methods.length - 1}](i,x,undefined,l,p)) : (prev.length === 0 ? '' : `

        for (let i = 1; i <= size; i++) {
          if (i !== size) res += `prev.length === ${i} ? `
          for (let j = 0; j < i; j++) res += `methods[${buildState.methods.length -1}](prev[${j}], ${j}, undefined, prev.length, ${j})` + (j === i - 1 ? '' : ' + ')
          if (i !== size) res += ' : '
        }
        return res + '))'
      }

      return `methods.each(${selector} || [], (i,x,l,p) => methods[${buildState.methods.length - 1}](i, x, ${aboveArray}, l, p))`
    },
    traverse: false,
    deterministic: engine.methods.map.deterministic
  })

  // Inside a compiled iterator body these read its arguments directly;
  // anywhere else they fall back to the iteration metadata in `above`.
  const inIterator = buildState => buildState.extraArguments && buildState.extraArguments.includes('position')

  /**
   * The innermost loop's metadata. `with` blocks and partials push a scope
   * without metadata; like Handlebars' data frames, loop data shows through them.
   */
  function loopMeta (above) {
    while (Array.isArray(above)) {
      if (above[0] && typeof above[0].position === 'number') return above[0]
      above = above[2]
    }
    return null
  }

  /** The body of the innermost `{{#> partial}}` being rendered, for `{{> @partial-block}}`. */
  function partialBlockOf (above) {
    while (Array.isArray(above)) {
      if (above[0] && above[0].partialBlock) return above[0].partialBlock
      above = above[2]
    }
    throw new Error('The partial @partial-block could not be found')
  }

  engine.addMethod('@last', {
    deterministic: false,
    sync: true,
    method: (args, context, above, engine) => {
      const meta = loopMeta(above)
      return meta ? meta.position === meta.length - 1 : null
    },
    compile: (data, buildState) => inIterator(buildState) ? `(length-1 === position)` : false
  })

  engine.addMethod('@first', {
    deterministic: false,
    sync: true,
    method: (args, context, above, engine) => {
      const meta = loopMeta(above)
      return meta ? meta.position === 0 : null
    },
    compile: (data, buildState) => inIterator(buildState) ? `(position === 0)` : false
  })

  engine.addMethod('@index', {
    deterministic: false,
    sync: true,
    method: (args, context, above, engine) => loopMeta(above)?.position ?? null,
    compile: (data, buildState) => inIterator(buildState) ? `position` : false
  })

  engine.addMethod('@key', {
    deterministic: false,
    sync: true,
    method: (args, context, above, engine) => loopMeta(above)?.index ?? null,
    compile: (data, buildState) => inIterator(buildState) ? `index` : false
  })

  engine.addMethod('hasItems', hasItems, { deterministic: true, sync: true, optimizeUnary: true })
  engine.addMethod('%isEmpty', isEmpty, { deterministic: true, sync: true, optimizeUnary: true })

  // A mustache section takes its inverse only for false, null and undefined;
  // `{{#zero}}` with 0 renders its body with 0 as the context.
  engine.addMethod('%noSection', (value) => (value ?? false) === false, { deterministic: true, sync: true, optimizeUnary: true })
  engine.methods['%noSection'].compile = (data, buildState) => buildState.compile`((${data} ?? false) === false)`

  /** Operations that never produce null, so concatenation needs no guard. */
  const producesString = item => item && typeof item === 'object' && ('cat' in item || 'each' in item || 'escape' in item)

  // The engine's compiled `cat` is a bare `'' + a + b`, which renders a missing
  // value as "null" where the interpreter skips it, and a single non-array
  // argument (`{ cat: { if: … } }`) falls back to a method call. Compile both
  // inline, skipping null and undefined the way the interpreter does.
  engine.methods.cat = {
    ...engine.methods.cat,
    compile: (data, buildState) => {
      if (typeof data === 'string') return JSON.stringify(data)
      if (typeof data === 'number') return JSON.stringify(String(data))
      const items = Array.isArray(data) ? data : [data]
      let res = buildState.compile`''`
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (typeof item === 'string' || typeof item === 'number' || producesString(item)) res = buildState.compile`${res} + ${item}`
        else res = buildState.compile`${res} + (${item} ?? '')`
      }
      return buildState.compile`(${res})`
    }
  }

  engine.addMethod('%root', {
    method: (args, context, above) => {
      let value = rootOf(context, above)
      const path = args[0] || []
      for (let i = 0; i < path.length; i++) {
        if (value === null || value === undefined) return null
        value = value[path[i]]
      }
      return typeof value === 'function' ? null : value ?? null
    },
    traverse: false,
    deterministic: false
  }, { sync: true })

  // Indents every line a standalone partial renders, as Handlebars does.
  engine.addMethod('%indent', ([indent, value]) => {
    if (typeof value !== 'string' || !value) return value
    return indent + value.replace(/\n(?!$)/g, '\n' + indent)
  }, { deterministic: true, sync: true })

  engine.methods['lt'] = engine.methods['<'];
  engine.methods['gt'] = engine.methods['>'];
  engine.methods['gte'] = engine.methods['>='];
  engine.methods['eq'] = engine.methods['=='];
  engine.methods['ne'] = engine.methods['!='];
  engine.methods['multiply'] = engine.methods['*'];
  engine.methods['divide'] = engine.methods['/'];
  engine.methods['add'] = engine.methods['+'];
  engine.methods['subtract'] = engine.methods['-'];
  // Like Handlebars, `lookup` reads only properties the object itself defines,
  // never ones inherited from its prototype (`constructor`, `__proto__`, ...).
  engine.addMethod('lookup', (args) => {
    const [obj, key] = args
    if (obj === null || obj === undefined) return null
    if (!hasOwn.call(Object(obj), key)) return null
    const value = obj[key]
    return value === undefined || typeof value === 'function' ? null : value
  }, { deterministic: true, sync: true })

  // A path through a prototype key (see the parser's PROTOTYPE_KEYS): only
  // properties the data defines itself are followed.
  engine.addMethod('%ownPath', ([value, parts]) => {
    for (let i = 0; i < parts.length; i++) {
      if (value === null || value === undefined || !hasOwn.call(Object(value), parts[i])) return null
      value = value[parts[i]]
    }
    return value === undefined || typeof value === 'function' ? null : value
  }, { deterministic: false, sync: true })
  engine.methods['default'] = engine.methods['??'];

  engine.addMethod('isArray', (args) => Array.isArray(args[0]), { deterministic: true, sync: true });
  engine.addMethod('type', (args) => typeof args[0], { deterministic: true, sync: true });
  engine.addMethod('log', (args) => { console.log(...processArgs(Array.isArray(args) ? args : [args])[0]); return '' }, { deterministic: false, sync: true });

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

          if (isEmpty(rArgs[0])) return ''
          return engine.run(content, rArgs[0], { above: [null, context, above] })
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

          if (isEmpty(rArgs[0])) return ''
          return engine.run(content, rArgs[0], { above: [null, context, above] })
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
          const scope = buildState.methods[position].aboveDetected ? '[null, context, above]' : 'above'
          buildState.methods.withValue = withValue
          return asyncPrefix + `methods.withValue(${Compiler.buildString(rArgs[0], buildState)}, methods[${position}], ${scope})`
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


  /**
   * Splits a partial call into its name, the context expression (an explicit
   * `{{> name ctx}}` argument, else null for the current context) and hash.
   */
  function partialCall (args) {
    const [rArgs, options] = processArgs(args, true)
    return [rArgs[0], rArgs.length > 1 ? rArgs[1] : null, options]
  }

  /** Handlebars merges a partial's hash over its context. */
  function partialContext (base, options) {
    if (!options) return base
    if (options['']) return options['']
    return (base && typeof base === 'object') ? { ...base, ...options } : options
  }

  /** Whether a partial reads only hash keys, making the context merge moot. */
  function readsOnlyHash (template, options) {
    if (!template.reads) return false
    for (const key of template.reads) if (!(key in options)) return false
    return true
  }

  /**
   * A partial by name: the nearest `{{#*inline}}` definition in scope, else a
   * registered partial. Inline definitions travel in the scope metadata.
   */
  function findPartial (path, above) {
    while (Array.isArray(above)) {
      const meta = above[0]
      if (meta && meta.inlinePartials && hasOwn.call(meta.inlinePartials, path)) return meta.inlinePartials[path]
      above = above[2]
    }
    return templates[path]
  }

  function getTemplate (path, above) {
    const template = findPartial(path, above)
    if (!template) throw new Error(`Template ${path} not found`)
    return template
  }

  /**
   * The current scope with inline partial definitions added to its metadata.
   * Each definition is bound to this scope: as in Handlebars, `../` inside an
   * inline partial climbs from where it was written, not from where it is called.
   */
  function inlineFrame (defs, above) {
    const meta = Array.isArray(above) ? above[0] : null
    const inlinePartials = Object.assign({}, meta && meta.inlinePartials)
    const frame = [Object.assign({}, meta, { inlinePartials }), Array.isArray(above) ? above[1] : undefined, Array.isArray(above) ? above[2] : undefined]
    for (const name in defs) inlinePartials[name] = bindInline(defs[name], frame)
    return frame
  }

  /**
   * Runs an inline definition in its defining scope, keeping what the call adds:
   * a partial block's body, and inline definitions written inside that body.
   */
  function bindInline (template, frame) {
    const bound = (context, callAbove, engine) => {
      const call = Array.isArray(callAbove) ? callAbove[0] : null
      let meta = frame[0]
      if (call) {
        meta = Object.assign({}, meta, call)
        if (call.inlinePartials) meta.inlinePartials = Object.assign({}, frame[0].inlinePartials, call.inlinePartials)
      }
      return template(context, [meta, frame[1], frame[2]], engine)
    }
    bound.usesPartialBlock = template.usesPartialBlock
    return bound
  }

  function markTemplate (fn, logic) {
    fn.usesPartialBlock = JSON.stringify(logic).includes('"%partialBlockContent"')
    return fn
  }

  /** Interpreted inline definitions, made once per definition set. */
  const interpretedDefs = new WeakMap()
  function interpretDefs (defs, engine) {
    let fns = interpretedDefs.get(defs)
    if (!fns) {
      fns = {}
      for (const name in defs) fns[name] = markTemplate((context, above, eng) => (eng || engine).run(defs[name], context, { above }), defs[name])
      interpretedDefs.set(defs, fns)
    }
    return fns
  }

  // `{{#*inline "name"}}…{{/inline}}` definitions, hoisted by the parser over the
  // content they were written in: `[definitions, body]`.
  engine.addMethod('%inlineScope', {
      method: ([defs, body], context, above, engine) => engine.run(body, context, { above: inlineFrame(interpretDefs(defs, engine), above) }),
      asyncMethod: ([defs, body], context, above, engine) => engine.run(body, context, { above: inlineFrame(interpretDefs(defs, engine), above) }),
      traverse: false,
      deterministic: false,
      compile: ([defs, body], buildState) => {
          const state = { ...buildState, asyncDetected: false, avoidInlineAsync: true, extraArguments: 'above' }
          let table = '{'
          for (const name in defs) {
              buildState.methods.push(markTemplate(Compiler.build(defs[name], state), defs[name]))
              table += `${JSON.stringify(name)}: methods[${buildState.methods.length - 1}], `
          }
          table += '}'
          const compiledBody = Compiler.build(body, state)
          buildState.methods.push(compiledBody)
          buildState.methods.inlineFrame = inlineFrame
          const asyncPrefix = Constants.isSync(compiledBody) ? '' : 'await '
          return `${asyncPrefix}methods[${buildState.methods.length - 1}](context, methods.inlineFrame(${table}, above))`
      }
  })

  engine.addMethod('%partial', {
      method: (args, context, above, engine) => {
          // Arguments arrive evaluated (the method traverses).
          const [path, ctx, options] = partialCall(args)
          const template = getTemplate(path, above)
          const base = ctx === null ? context : ctx
          return template(partialContext(base, options), [null, context, above], engine)
      },
      asyncMethod: async (args, context, above, engine) => {
          const [path, ctx, options] = partialCall(args)
          const template = getTemplate(path, above)
          const base = ctx === null ? context : ctx
          return template(partialContext(base, options), [null, context, above], engine)
      },
      traverse: true,
      deterministic: (data, buildState) => {
          const check = buildState.engine.methods.map.deterministic
          const [path, ctx, options] = partialCall(data)
          const template = templates[path]
          if (!template) return false
          if (ctx !== null) return check([ctx, options ? Object.values(options) : []], buildState) && template.deterministic
          if (!options) return check([path], buildState) && template.deterministicInline
          if (options['']) return check([Object.values(options)], buildState) && template.deterministic
          // The hash is merged over the caller's context, so the partial is only
          // independent of that context when everything it reads is in the hash.
          if (!readsOnlyHash(template, options)) return false
          return check([Object.values(options)], buildState) && template.deterministic
      },
      compile: (data, buildState) => {
          const [path, ctx, options] = partialCall(data)
          const template = templates[path]
          // Not registered yet: look it up when the template runs.
          if (!template) return false
          if (options?.['']) return buildState.compile`${template}(${options['']}, [null, context, above], engine)`
          if (!options && ctx === null) return false

          buildState.methods.partialContext = partialContext
          const base = ctx === null ? buildState.compile`context` : ctx
          if (!options) return buildState.compile`${template}(${base}, [null, context, above], engine)`

          let res = buildState.compile`{`
          let first = true
          for (const key in options) {
              res = buildState.compile`${res}${first ? buildState.compile`` : buildState.compile`,`} ${key}: ${options[key]}`
              first = false
          }
          res = buildState.compile`${res} }`
          if (ctx === null && readsOnlyHash(template, options)) return buildState.compile`${template}(${res}, [null, context, above], engine)`
          return buildState.compile`${template}(methods.partialContext(${base}, ${res}), [null, context, above], engine)`
      }
  })

  // `{{#> name}}body{{/name}}`: the partial if it is registered, else the body.
  // A partial that renders `{{> @partial-block}}` gets the body passed down in
  // its scope metadata; the body runs in the caller's scope.
  function partialBlockTarget (data) {
    const [path, content, ...args] = data
    if (templates[path]) return { '%partial': [path, ...args] }
    // The fallback body renders with the partial's context argument, if given.
    const ctx = partialCall([path, ...args])[1]
    return ctx === null ? content : { with: [ctx, content] }
  }

  const usesPartialBlock = template => template && template.usesPartialBlock

  function runPartialBlock (args, context, above, engine, evaluate) {
    const [path, content, ...rest] = args
    const template = findPartial(path, above)
    if (!template) return engine.run(partialBlockTarget(args), context, { above })
    const [, ctx, options] = partialCall([path, ...rest])
    const block = { partialBlock: (c) => engine.run(content, c, { above }) }
    // Inline partials defined in the block's body are visible to the partial too.
    const scope = content && content['%inlineScope']
    if (scope) block.inlinePartials = inlineFrame(interpretDefs(scope[0], engine), above)[0].inlinePartials
    return evaluate([ctx, options, block], template)
  }

  /**
   * Renders a compiled partial block whose body defines inline partials: the
   * partial (found when the template runs) sees those definitions, and its
   * `{{> @partial-block}}` renders the body.
   */
  function renderScopedPartialBlock (path, defs, body, ctx, options, context, above, engine) {
    const template = findPartial(path, above)
    if (!template) return ctx === undefined ? body(context, above) : body(ctx, [null, context, above])
    const block = { partialBlock: (c) => body(c, above), inlinePartials: inlineFrame(defs, above)[0].inlinePartials }
    return template(partialContext(ctx === undefined ? context : ctx, options), [block, context, above], engine)
  }

  function compileScopedPartialBlock (path, content, defs, rest, buildState) {
    const state = { ...buildState, asyncDetected: false, avoidInlineAsync: true, extraArguments: 'above' }
    let table = '{'
    for (const name in defs) {
      buildState.methods.push(markTemplate(Compiler.build(defs[name], state), defs[name]))
      table += `${JSON.stringify(name)}: methods[${buildState.methods.length - 1}], `
    }
    table += '}'
    buildState.methods.push(Compiler.build(content, state))
    const body = `methods[${buildState.methods.length - 1}]`
    buildState.methods.renderScopedPartialBlock = renderScopedPartialBlock
    buildState.methods.partialContext = partialContext
    buildState.methods.inlineFrame = inlineFrame

    const [, ctx, options] = partialCall([path, ...rest])
    const ctxCode = ctx === null ? 'undefined' : Compiler.buildString(ctx, buildState)
    let optionsCode = 'null'
    if (options) {
      const entries = []
      for (const key in options) entries.push(`${JSON.stringify(key)}: ${Compiler.buildString(options[key], buildState)}`)
      optionsCode = `{ ${entries.join(', ')} }`
    }
    return `methods.renderScopedPartialBlock(${JSON.stringify(path)}, ${table}, ${body}, ${ctxCode}, ${optionsCode}, context, above, engine)`
  }

  engine.addMethod('%partialBlock', {
      method: (args, context, above, engine) => runPartialBlock(args, context, above, engine, ([ctx, options, block], template) => {
        if (options) for (const key in options) options[key] = engine.run(options[key], context, { above })
        const base = ctx === null ? context : engine.run(ctx, context, { above })
        return template(partialContext(base, options), [block, context, above], engine)
      }),
      asyncMethod: (args, context, above, engine) => runPartialBlock(args, context, above, engine, async ([ctx, options, block], template) => {
        if (options) for (const key in options) options[key] = await engine.run(options[key], context, { above })
        const base = ctx === null ? context : await engine.run(ctx, context, { above })
        return template(partialContext(base, options), [block, context, above], engine)
      }),
      traverse: false,
      // Only decidable now if the partial is registered: one registered later must
      // still replace the fallback body, so that body cannot be inlined early.
      deterministic: (data, buildState) => Boolean(templates[data[0]]) && !usesPartialBlock(templates[data[0]]) &&
        !(data[1] && data[1]['%inlineScope']) && buildState.engine.methods.if.deterministic([partialBlockTarget(data)], buildState),
      compile: (data, buildState) => {
          buildState.methods.partialContext = partialContext
          const [path, content, ...rest] = data
          const template = templates[path]
          const scope = content && content['%inlineScope']
          // The body defines inline partials the partial can see (the layout
          // pattern): compile the body and definitions now, pick the partial when
          // the template runs.
          if (scope && !buildState.async) return compileScopedPartialBlock(path, content, scope[0], rest, buildState)
          // Not registered yet: resolve when the template runs.
          if (!template || scope) return false
          if (!usesPartialBlock(template)) return Compiler.buildString(partialBlockTarget(data), buildState)

          const body = Compiler.build(content, { ...buildState, asyncDetected: false, avoidInlineAsync: true, extraArguments: 'above' })
          buildState.methods.push(body)
          const block = buildState.compile`{ partialBlock: (c) => methods[${buildState.methods.length - 1}](c, above) }`
          const [, ctx, options] = partialCall([path, ...rest])
          const base = ctx === null ? buildState.compile`context` : ctx
          if (!options) return buildState.compile`${template}(${base}, [${block}, context, above], engine)`
          let res = buildState.compile`{`
          let first = true
          for (const key in options) {
              res = buildState.compile`${res}${first ? buildState.compile`` : buildState.compile`,`} ${key}: ${options[key]}`
              first = false
          }
          res = buildState.compile`${res} }`
          return buildState.compile`${template}(methods.partialContext(${base}, ${res}), [${block}, context, above], engine)`
      }
  })

  engine.methods['%partialScoped'] = { ...engine.methods['%partial'], deterministic: false, compile: () => false }
  engine.methods['%partialBlockScoped'] = { ...engine.methods['%partialBlock'], deterministic: false, compile: () => false }

  engine.addMethod('%partialBlockContent', {
      method: (args, context, above) => partialBlockOf(above)(context),
      asyncMethod: async (args, context, above) => partialBlockOf(above)(context),
      traverse: false,
      deterministic: false
  })

  // A raw block helper hands back its verbatim body: `{{{{raw}}}}{{x}}{{{{/raw}}}}`.
  engine.addMethod('raw', (args) => Array.isArray(args) ? args[args.length - 1] : args, { deterministic: true, sync: true })

  // Warning: This guy isn't scoped to the template; so registering in one template will register in all
  // This can allow for mangling.
  engine.addMethod('inline', {
      method: (args, context, above, engine) => {
          // A later definition replaces an earlier one, as in compiled mode.
          const name = args[0]
          const content = args[args.length - 1]
          templates[name] = (context, above, engine) => engine.run(content, context, { above })
          templates[name].deterministic = engine.methods.map.deterministic([null, content], { engine })
          templates[name].reads = contextReads(content)
          templates[name].usesPartialBlock = JSON.stringify(content).includes('"%partialBlockContent"')
          return ''
      },
      traverse: false,
      compile: (data, buildState) => {
          const content = data[data.length - 1]
          templates[data[0]] = Compiler.build(content, { ...buildState, avoidInlineAsync: true, extraArguments: 'above' })
          templates[data[0]].deterministic = buildState.engine.methods.map.deterministic([null, content], buildState)
          templates[data[0]].reads = contextReads(content)
          templates[data[0]].usesPartialBlock = JSON.stringify(content).includes('"%partialBlockContent"')
          return '""'
      }
  }, { sync: true })

  engine.methods = toFastProperties(engine.methods)
  if (engine.fallback) engine.fallback.methods = engine.methods
  return engine
}

/**
 * With this many methods V8 stores `engine.methods` as a hash table, which makes
 * the `engine.methods[...]` lookups in compiled templates several times slower.
 * An object literal with the same entries stays in fast mode. Building one needs
 * `new Function`; where that is unavailable (interpreted-only environments),
 * using the object as a prototype recovers most of the speed.
 */
function toFastProperties (obj) {
  const keys = Object.keys(obj)
  try {
    // eslint-disable-next-line no-new-func
    const build = new Function('v', 'return {' + keys.map((key, i) => JSON.stringify(key) + ': v[' + i + ']').join(',') + '}')
    return build(keys.map(key => obj[key]))
  } catch {
    function Fast () {}
    Fast.prototype = obj
    // eslint-disable-next-line no-new
    new Fast()
    return obj
  }
}
