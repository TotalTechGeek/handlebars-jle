// Todo: Actually use this -- this actually works fine, but is not exposed to the user
// The other issue is that I need to figure out how to deal with fs and such in the browser ;) 

import { Compiler } from "json-logic-engine"
import { compileToJSON, engine, processArgs } from "./index.js"
import fs from 'fs'

const templates = {}
engine.addMethod('partial', {
    method: (args, context, above, engine) => {
        const path = args[0]
        const options = processArgs(args, true)[1]
        if (!templates[path]) {
            const logic = compileToJSON(fs.readFileSync(path, 'utf-8'))
            templates[path] = (context, above) => engine.run(logic, context, { above })
            templates[path].deterministic = engine.methods.map.deterministic([null, logic], { engine })
        }
        if (options) for (const key in options) options[key] = engine.run(options[key], context, { above })
        if (options?.['']) return templates[path](options[''], [null, context, above])
        else if (options) return templates[path](options, [null, context, above])        
        return templates[path](context, [null, context, above])
    },
    asyncMethod: async (args, context, above, engine) => {
        const path = args[0]
        const options = processArgs(args, true)[1]
        if (!templates[path]) {
            const logic = compileToJSON(fs.readFileSync(path, 'utf-8'))
            templates[path] = (context, above) => engine.run(logic, context, { above })
            templates[path].deterministic = engine.methods.map.deterministic([null, logic], { engine })
        }
        if (options) for (const key in options) options[key] = await engine.run(options[key], context, { above })
        if (options?.['']) return templates[path](options[''], [null, context, above])
        else if (options) return templates[path](options, [null, context, above])
        return templates[path](context, [null, context, above])
    },
    traverse: true,
    deterministic: (data, buildState) => {
        const check = buildState.engine.methods.map.deterministic
        const [rArgs, options] = processArgs(data, true)
        if (!options) return false
        return check([Object.values(options), rArgs], buildState) && templates[rArgs[0]].deterministic
    },
    compile: (data, buildState) => {
        const path = data[0]
        const options = processArgs (data, true)[1]
        if (!templates[path]) templates[path] = Compiler.build(fs.readFileSync(path), { ...buildState, avoidInlineAsync: true, extraArguments: 'above' })    
        if (options?.['']) return buildState.compile`${templates[path]}(${options['']}, [null, context, above])`

        if (options) {
            let res = buildState.compile`{`
            let first = true
            for (const key in options) {
                res = buildState.compile`${res}${first ? buildState.compile`` : buildState.compile`,`} ${key}: ${options[key]}`
                first = false
            }
            res = buildState.compile`${res} }`
            return buildState.compile`${templates[path]}(${res}, [null, context, above])`
        }
        
        return false
    }
})

// Warning: This guy isn't scoped to the template; so registering in one template will register in all
// This can allow for mangling.
engine.addMethod('register', {
    method: (args, context, above, engine) => {
        const name = args[0]
        const content = args.pop()
        templates[name] = (context) => engine.run(content, context)
        templates[name].deterministic = engine.methods.map.deterministic([null, content], { engine })
        return ''
    },
    traverse: false,
    compile: (data, buildState) => {
        const content = data.pop()
        templates[data[0]] = Compiler.build(content, { ...buildState, avoidInlineAsync: true, extraArguments: 'above' })
        templates[data[0]].deterministic = buildState.engine.methods.map.deterministic([null, content], buildState)
        return '""'
    }
}, { sync: true })