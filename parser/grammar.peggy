{
  let HashArg = Symbol.for('HashArg')

  function wrapEscape (obj) {
    if (options.noEscape) return obj
    return { escape: obj }
  }

  const varAccess = options.recurse ? 'rvar' : 'var'
}


Content = data:(EscapedElement / Element / Text)* { return { cat: data } }
EscapedElement = "\\" Element { return text() }
Element = "{{ESCAPED_CHAR " escapedChar:. "}}" { return escapedChar }
  / startTag:sTag content:Content endTag:eTag {
    if (startTag.name != endTag && startTag.oName != endTag) throw new Error("Expected {{/" + startTag.name + "}} but {{/" + endTag + "}} found.");
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

sTag = "{{#" name:TagName args:Arg* "}}" '\n'? { 
  const found = name in (options.methods || {}) || name === 'with' || name === 'if' || name === 'each'
  // Assume implicit iteration / if; workaround.
  if (!found && !args.length) return { oName: name, name: '$eachOrIf', args }
  return { name, args }; 
}
selfTag = "{{" name:TagName args:Arg* "}}" { 
  if (name === '.' || name === 'this') return wrapEscape({ var: '' })
  if (name === "@key" || name === "@index") return wrapEscape({ var: '../index'})
  if (name === '^') return wrapEscape({ [varAccess]: 'else' })
  if (name.startsWith("this.")) return wrapEscape({ var: name.substring(5) })
  const variableObj = { [varAccess]: name.replace(/\.\.\//g, '../../').replace(/\.\.\/this\.?/g, '../') }
  if (name in (options.methods || {}) && !args.length) return { if: [variableObj, wrapEscape(variableObj), { [name]: [] }] }
  if (!args.length) return wrapEscape(variableObj); 
  return { [name]: args }
} / "{{{" name:TagName "}}}" {
  if (name === '.' || name === "this") return { var: '' }
  if (name === "@index" || name === "@key") return { var: '../index'}
  if (name.startsWith("this.")) return { var: name.substring(5) }
  return { [varAccess]: name.replace(/\.\.\//g, '../../').replace(/\.\.\/this\.?/g, '../') }
} 

eTag = _ "{{/" name:TagName "}}" { return name; }
TagName = '../'+ [@$a-zA-Z_.-]* { return text(); }
  / './' [@$a-zA-Z_.-]+ { return text().substring(2); }
  / ([@$a-zA-Z_.-]+ / "^") { return text(); }
Text = ([^{}\\] / "{" !"{" / "}" !"}")+ { return text(); }
Arg = _ data:(Func / Boolean / Null / Undefined / HashArg / Variable / Number / Str) _ { return data }
Variable = chars:[@$a-zA-Z_./-]+ { 
  chars = chars.join("").replace(/\.\.\//g, '../../').replace(/\.\.\/this\.?/g, '../')
  if (chars === "@index" || chars === "@key") return { var: '../index' }
  if (chars === "this" || chars === '.') return { var: '' }
  if (chars.startsWith("this.")) return { [varAccess]: chars.substring(5) }
  return { [varAccess]: chars }; 
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