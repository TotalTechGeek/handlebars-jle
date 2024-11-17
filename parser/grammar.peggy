{
  let HashArg = Symbol.for('HashArg')

  function wrapEscape (obj) {
    if (options.noEscape) return obj
    return { escape: obj }
  }
}

Content = data:(Element / Text)* { return { cat: data } }
Element = startTag:sTag content:Content endTag:eTag {
    if (startTag.name != endTag && startTag.oName != endTag) {
      throw new Error(
        "Expected {{/" + startTag.name + "}} but {{/" + endTag + "}} found."
      );
    }
    if (typeof content.cat[content.cat.length -1] === 'string') content.cat.push(content.cat.pop().trimEnd())
    // Patch for #if
    if (startTag.name === 'if') {
      const chunks = [[{ cat: [] }]]
      let defaulted = false
      for (const item of content.cat) {
        if (item.var === 'else' || (item.escape && item.escape.var === 'else')) {
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
    return { cat: { [startTag.name]: [...startTag.args, content] }};
  }
  / startTag:selfTag { return startTag; }

sTag = "{{#" name:TagName args:Arg* "}}" { 
  const found = name in (options.methods || {}) || name === 'with' || name === 'if' || name === 'each'
  // Assume implicit iteration
  if (!found) return { oName: name, name: 'each', args: [{ var: name }, ...args] }
  return { name, args }; 
}
selfTag = "{{" name:TagName args:Arg* "}}" { 
  if (name === "this") return wrapEscape({ var: '' })
  if (name === "@key") return wrapEscape({ var: '../index'})
  if (name === "@index") return wrapEscape({ var: '../index'})
  if (name.startsWith("this.")) return wrapEscape({ var: name.substring(5) })
  const variableObj = { var: name.replace(/\.\.\//g, '../../').replace(/\.\.\/this\.?/g, '../') }
  if (name in (options.methods || {}) && !args.length) return { if: [variableObj, wrapEscape(variableObj), { [name]: [] }] }
  if (!args.length) return wrapEscape(variableObj); 
  return { [name]: args }
} / "{{{" name:TagName "}}}" {
  if (name === "this") return { var: '' }
  if (name === "@key") return { var: '../index'}
  if (name === "@index") return { var: '../index'}
  if (name.startsWith("this.")) return { var: name.substring(5) }
  return { var: name.replace(/\.\.\//g, '../../').replace(/\.\.\/this\.?/g, '../') }
}

eTag = _ "{{/" name:TagName "}}" { return name; }
TagName = test:'../'+ chars:[@$a-zA-Z_.-]* { return test.join('') + chars.join(""); }
  / chars:[@$a-zA-Z_.-]+ { return chars.join(""); }
Text = chars:([^{}] / "{" !"{" / "}" !"}")+ { return chars.flat().join(""); }
Arg = _ data:(Func / Boolean / Null / Undefined / HashArg / Variable / Number / Str) _ { return data }
Variable = chars:[@$a-zA-Z_./-]+ { 
  chars = chars.join("").replace(/\.\.\//g, '../../').replace(/\.\.\/this\.?/g, '../')
  if (chars === "@key") return { var: '../index' }
  if (chars === "@index") return { var: '../index' }
  if (chars === "this") return { var: '' }
  if (chars.startsWith("this.")) return { var: chars.substring(5) }
  return { var: chars }; 
}
Boolean = data:("true" / "false") { return data === "true" }
Null = "null" { return null }
Undefined = "undefined" { return undefined }
HashArg = val:Variable _ "=" data:Arg { return { preserve: { [val.var]: data, [HashArg]: true } }; }
Number   = chars:[0-9]+ { return parseInt(chars.join(""), 10) }
Str = "\"" chars:[^\"]* "\"" { return chars.join(""); }
 / "\'" chars:[^"'"]* "\'" { return chars.join(""); }
Func = "(" name:TagName  args:Arg* ")" { return { [name]: args } }
_ = [ \t\n\r]*