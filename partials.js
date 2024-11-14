// Todo: Actually use this -- this actually works fine, but is not exposed to the user

const templates = {}
engine.addMethod('partial', {
    method: (args, context, above, engine) => {
        const path = args[0]
        const options = processArgs(args, true)[1]
        if (!templates[path]) templates[path] = compile(fs.readFileSync(path, 'utf-8'))
        if (options) for (const key in options) options[key] = (engine.fallback || engine).run(options[key], context, { above })
        if (options?.['']) return templates[path](options[''])
        else if (options) return templates[path](options)        
        return templates[path](context?.[Constants.Override] ?? context)
    },
    asyncMethod: async (args, context) => {
        const path = args[0]
        const options = processArgs(args, true)[1]
        if (!templates[path]) templates[path] = await compileAsync(fs.readFileSync(path, 'utf-8'))
        if (options) for (const key in options) options[key] = await engine.run(options[key], context, { above })
        if (options?.['']) return templates[path](options[''])
        else if (options) return templates[path](options)
        return templates[path](context?.[Constants.Override] ?? context)
    },
    useContext: true,
    traverse: true,
    deterministic: (data, buildState) => {
        const check = buildState.engine.methods.if.deterministic
        const [rArgs, options] = processArgs(data, true)
        if (!options) return false
        return check([Object.values(options), rArgs], buildState)
    }
})

engine.addMethod('register', {
    method: (args, context, above, engine) => {
        const name = args[0]
        const content = args.pop()
        templates[name] = (engine.fallback || engine).build(content)
        return ''
    },
    asyncMethod: async (args, context, above, engine) => {
        const name = args[0]
        const content = args.pop()
        templates[name] = await engine.build(content)
        return ''
    },
    traverse: false,
    deterministic: true // Only needs to be run once
})