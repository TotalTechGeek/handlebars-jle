{
  let HashArg = Symbol.for('HashArg')

  let blockParams = new Set()
  function wrapEscape (obj) {
    if (options.noEscape) return obj
    return { escape: obj }
  }

  function getVar (name) {
    if (blockParams.has(name.split('.')[0])) return { rvar: name }
    return { [varAccess]: name }
  }

  const varAccess = options.recurse ? 'rvar' : 'var'
}


Content = data:(EscapedElement / Element / Text)* { return { cat: data } }
EscapedElement = "\\" Element { return text() }
Element = "{{ESCAPED_CHAR " escapedChar:. "}}" { return escapedChar }
  / startTag:sTag content:Content endTag:eTag {
    if (startTag.name != endTag && startTag.oName != endTag) throw new Error("Expected {{/" + startTag.name + "}} but {{/" + endTag + "}} found.");

    // Remove block param value deoptimization
    if (startTag.as) for (const item of startTag.as) blockParams.delete(item)

    if (typeof content.cat[content.cat.length -1] === 'string') content.cat.push(content.cat.pop())
    // Patch for #if and #unless
    if (startTag.name === 'if' || startTag.name === 'unless') {
      // Admittedly, this unless hack is a little not cool, maybe I should add something into JSON Logic, like macros to make it easier
      // to macro-ify things like this.
      if (startTag.name === 'unless') startTag.args[0] = { not: startTag.args[0] }
      const chunks = [[{ cat: [] }]]
      let defaulted = false
      for (const item of content.cat) {
        if (item[varAccess] === 'else' || (item.escape && item.escape[varAccess] === 'else')) {
          chunks.push([{ cat: [] }]) 
          defaulted = true
		  continue
        }
        if (item.else) {
          chunks.push([item.else[1], { cat: [] }])
          continue
        }
        const lastChunk = chunks[chunks.length - 1]
        lastChunk[lastChunk.length-1].cat.push(item)
      }
      if (!defaulted) chunks.push('')
      return { cat: { if: [startTag.args[0], ...chunks.flat()] } };
    }

    // Workaround to support implicit iteration / if. 
    if (startTag.name === '$eachOrIf') {
      const variable = { var: startTag.oName }
      // If we wanted it to iterate over all Objects - we could do this:
      // { eq: [{ and: [variable, { type: [variable] }] }, 'object'] } 
      return { cat: { if: [{ isArray: [variable] }, { each: [variable, content] }, { if: [variable, content, ''] }] } }
    }

  return { cat: { [startTag.name]: [...startTag.args, content] }};
  }
  / startTag:selfTag { return startTag; }

sTag = "{{#" name:TagName args:Arg* as:asBlock? "}}" '\n'? { 
  const found = name in (options.methods || {}) || name === 'with' || name === 'if' || name === 'each'
  // Assume implicit iteration / if; workaround.
  if ((as||[]).length) {
    if(args[args.length - 1][varAccess] === 'as') args.pop()
    else error('You need to use as when using block arguments')
    as = as.map(i => i.rvar || i.var)
    if (as.some(i => !i)) error('You need to give a name to each block argument')
    if (as.some(i => i.includes('.'))) error('You cannot use a dot in your name for block arguments')
    for (const item of as) blockParams.add(item)
    args.push({ '%HashArg': ['as', as], [HashArg]: true })
  }
  if (!found && !args.length) return { oName: name, name: '$eachOrIf', args }
  return { name, args, as }; 
}

asBlock = "|" _ names:Arg* _ "|" { return names }
selfTag = "{{" name:TagName args:Arg* "}}" { 
  if (name === '.' || name === 'this') return wrapEscape({ var: '' })
  if (name === "@key" || name === "@index") return wrapEscape({ var: '../index'})
  if (name === '^') return wrapEscape(getVar('else'))
  if (name.startsWith("this.")) return wrapEscape({ var: name.substring(5) })
  const variableObj = getVar(name.replace(/\.\.\//g, '../../').replace(/\.\.\/this\.?/g, '../'))
  if (name in (options.methods || {}) && !args.length) return { if: [variableObj, wrapEscape(variableObj), { [name]: [] }] }
  if (!args.length) return wrapEscape(variableObj); 
  return { [name]: args }
} / "{{{" name:TagName "}}}" {
  if (name === '.' || name === "this") return { var: '' }
  if (name === "@index" || name === "@key") return { var: '../index'}
  if (name.startsWith("this.")) return { var: name.substring(5) }
  return getVar(name.replace(/\.\.\//g, '../../').replace(/\.\.\/this\.?/g, '../'))
} /  "{{>" _ name:TagName args:Arg* "}}" {
  return { "%partial": [name, ...args] }
}

eTag = _ "{{/" name:TagName "}}" { return name; }
TagName = '../'+ [@$a-zA-Z_.0-9-]* { return text(); }
  / './' [@$a-zA-Z_.0-9-]+ { return text().substring(2); }
  / ([@$a-zA-Z_.-][@$a-zA-Z_.0-9-]* / "^") { return text(); }
Text = ([^{}\\] / "{" !"{" / "}" !"}")+ { return text(); }
Arg = _ data:(Func / Boolean / Null / Undefined / HashArg / Variable / Number / Str) _ { return data }
Variable = ([@$a-zA-Z_./-][@$a-zA-Z_./0-9-]*) { 
  let chars = text().replace(/\.\.\//g, '../../').replace(/\.\.\/this\.?/g, '../')
  if (chars === "@index" || chars === "@key") return { var: '../index' }
  if (chars === "this" || chars === '.') return { var: '' }
  if (chars.startsWith("this.")) return getVar(chars.substring(5))
  return getVar(chars); 
}
Boolean = data:("true" / "false") { return data === "true" }
Null = "null" { return null }
Undefined = "undefined" { return undefined }
HashArg = val:Variable _ "=" data:Arg { return { '%HashArg': [val[varAccess], data], [HashArg]: true } }; 
Number   = [0-9]+ { return +text() }
Str = "\"" chars:[^\"]* "\"" { return chars.join(""); }
 / "\'" chars:[^"'"]* "\'" { return chars.join(""); }
Func = "(" name:TagName  args:Arg* ")" { return { [name]: args } }
_ = [ \t\n\r]*