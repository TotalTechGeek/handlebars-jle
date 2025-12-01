import { Compiler, Constants } from "json-logic-engine";
const HashArg = Symbol.for('HashArg');


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
function createBlockParamContext (index, value, as, length) {
    const val = { index, length }
    if (!as) return val
    if (as.length === 1) val[as[0]] = value
    else if (as.length >= 2) val[as[0]] = value, val[as[1]] = index
    return val
}

function each (iterable, func) {
    let res = ''
    if (Array.isArray(iterable)) {
      const len = iterable.length
      let i = 0
      // let's also go with 8
      for (; i < iterable.length - 7; i += 8) res += func(iterable[i], i, len) + func(iterable[i+1], i+1, len) + func(iterable[i+2], i+2, len) + func(iterable[i+3], i+3, len) + func(iterable[i+4], i+4, len) + func(iterable[i+5], i+5, len) + func(iterable[i+6], i+6, len) + func(iterable[i+7], i+7, len)
      for (; i < iterable.length - 3; i += 4) res += func(iterable[i], i, len) + func(iterable[i+1], i+1, len) + func(iterable[i+2], i+2, len) + func(iterable[i+3], i+3, len)
      for (; i < iterable.length; i++) res += func(iterable[i], i, len)
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
    const len = iterable.length
    for (let i = 0; i < iterable.length; i++) res += await func(iterable[i], i, len)
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

  /**
    * Mechanism for swapping out the context for interpreted each loops
    */
  function swapContext (struct, iterable, i, as) {
    struct.above[0] = createBlockParamContext(i, iterable[i], as, iterable.length)
    return struct
  }


  engine.addMethod('each', {
    method: (preprocessed, context, above, engine) => {
      const [data, options] = processArgs(preprocessed)
      const iterable = engine.run(data[0], context, above)
      if (!iterable) return ''
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
        if (iterable instanceof Map) for (const [key, value] of iterable) res += engine.run(data[1], value, swapContext(struct, iterable, key, options.as))
        else for (const item of iterable) res += engine.run(data[1], item, swapContext(struct, iterable, i++, options.as))
      } else if (typeof iterable === 'object') {
        if (optimizedFn && typeof optimizedFn === 'function') for (const key in iterable) res += optimizedFn(iterable[key], swapContext(struct, iterable, key, options.as).above)
        else for (const key in iterable) res += engine.run(data[1], iterable[key], swapContext(struct, iterable, key, options.as))
      }
      return res
    },
    asyncMethod: async (preprocessed, context, above, engine) => {
      const [data, options] = processArgs(preprocessed)
      const iterable = await engine.run(data[0], context, above, engine)
      if (!iterable) return ''
      let res = ''
      const struct = { above: [null, context, above] }
      if (Array.isArray(iterable)) {
        for (let i = 0; i < iterable.length; i++) res += await engine.run(data[1], iterable[i], swapContext(struct, iterable, i, options.as))
      } else if (iterable && typeof iterable[Symbol.iterator] === 'function') {
        // Todo: Add Async Iterator Support
        let i = 0
        if (iterable instanceof Map) for (const [key, value] of iterable) res += await engine.run(data[1], value, swapContext(struct, iterable, key, options.as))
        else for (const item of iterable) res += await engine.run(data[1], item, swapContext(struct, iterable, i++, options.as))
      } else if (typeof iterable === 'object') {
        for (const key in iterable) {
          res += await engine.run(data[1], iterable[key], swapContext(struct, iterable, key, options.as))
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
        extraArguments: 'index, above, length'
      }
      mapper = Compiler.build(mapper, mapState)
      buildState.methods.push(mapper)
      buildState.methods.each = each
      buildState.methods.eachAsync = eachAsync

      // Todo: Maybe we can make a utility for this.
      let currentState = '{ "index": x }'
      if (options.as) {
        if (options.as.length === 1) currentState = `{ "index": x, ${JSON.stringify(options.as[0])}: i }`
        if (options.as.length >= 2) currentState = `{ "index": x, ${JSON.stringify(options.as[0])}: i, ${JSON.stringify(options.as[1])}: x }`
      }


      const aboveArray = mapper.aboveDetected ? `[${currentState}, context, above]` : 'null'

      if (async) {
        if (!Constants.isSync(mapper)) {
          buildState.detectAsync = true
          return `await methods.eachAsync(${selector} || [], (i,x,l) => methods[${
            buildState.methods.length - 1
          }](i, x, ${aboveArray}, l))`
        }
      }

      if (!mapper.aboveDetected) {
        const size = 4
        // let's build out branches up to 5, then fallback to each
        let res = `(!Array.isArray(prev = ${selector} || []) || prev.length > ${size} ? methods.each(prev, (i,x,l) => methods[${buildState.methods.length - 1}](i,x,undefined,l)) : (prev.length === 0 ? '' : `

        for (let i = 1; i <= size; i++) {
          if (i !== size) res += `prev.length === ${i} ? `
          for (let j = 0; j < i; j++) res += `methods[${buildState.methods.length -1}](prev[${j}], ${j}, undefined, prev.length)` + (j === i - 1 ? '' : ' + ')
          if (i !== size) res += ' : '
        }
        return res + '))'
      }

      return `methods.each(${selector} || [], (i,x,l) => methods[${buildState.methods.length - 1}](i, x, ${aboveArray}, l))`
    },
    traverse: false,
    deterministic: engine.methods.map.deterministic
  })

  engine.addMethod('@last', {
    deterministic: false,
    sync: true,
    method: (args, context, above, engine) => {
        return above[0]?.index === (above[0]?.length -1)
    },
    compile: (data, buildState) => {
      if (buildState.extraArguments && buildState.extraArguments.includes('length')) return `(length-1 === index)`
      return 'null'
    }
  })

  engine.addMethod('@first', {
    deterministic: false,
    sync: true,
    method: (args, context, above, engine) => {
      return above[0]?.index === 0
    },
    compile: (data, buildState) => {
      if (buildState.extraArguments) return `(index === 0)`
      return 'null'
    }
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
  engine.methods['default'] = engine.methods['??'];

  engine.addMethod('isArray', (args) => Array.isArray(args[0]), { deterministic: true, sync: true });
  engine.addMethod('type', (args) => typeof args[0], { deterministic: true, sync: true });
  engine.addMethod('log', ([value]) => { console.log(value); return value }, { deterministic: true, sync: true });

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

  return engine
}
