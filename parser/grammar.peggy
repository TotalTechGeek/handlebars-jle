{
  let HashArg = Symbol.for('HashArg')
}

Content = data:(Element / Text)* { return { cat: data } }
Element = startTag:sTag content:Content endTag:eTag {
    if (startTag.name != endTag) {
      throw new Error(
        "Expected {{/" + startTag + "}} but {{/" + endTag + "}} found."
      );
    }
    if (typeof content.cat[content.cat.length -1] === 'string') content.cat.push(content.cat.pop().trimEnd())
    // Patch for #if
    if (startTag.name === 'if') {
      const chunks = [[{ cat: [] }]]
      let defaulted = false
      for (const item of content.cat) {
        if (item.var === 'else') {
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
      return { cat: [startTag.newline ? '\n' : '', { if: [startTag.args[0], ...chunks.flat()] }] };
    }
    return { cat: [startTag.newline ? '\n' : '',  { cat: { [startTag.name]: [...startTag.args, content] }}] };
  }
  / startTag:selfTag { return startTag; }

sTag = "\n" " "* "{{#" name:TagName args:Arg* "}}" "\n" { return { name, args, newline: true }; }
/ "{{#" name:TagName args:Arg* "}}" { return { name, args }; }
selfTag = "{{" name:TagName args:Arg* "}}" { 
  if (name === "this") return { var: '' }
  if (name === "@key") return { var: '../index'}
  if (name === "@index") return { var: '../index'}
  if (name.startsWith("this.")) return { var: name.substring(5) }
  if (!args.length)  return { var: name.replace(/\.\.\//g, '../../').replace(/\.\.\/this\.?/g, '../') }; 
  return { [name]: args }
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