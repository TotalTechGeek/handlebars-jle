# Handlebars (JSON Logic Edition)

Hey there! The documentation for this module is still being rewritten.

This is an implementation of Handlebars that processes templates into JSON Logic, which is then used by JSON Logic Engine to optimize and evaluate the templates.

This implementation of Handlebars appears to be ~25x faster than the original implementation, and allows for more variety in execution strategy.

I will admit upfront that there are some differences in this implementation compared to the original Handlebars. I will try to document these differences as I go along.

Some of the obvious differences include:

- Asynchronous Execution is fully supported; this means you can add async helpers natively.
- ~~Iteration is strictly done via block expressions like `#each`, implicit iteration is not supported. (Use `#each kids` instead of `#kids`)~~
- There are significantly more built-in helpers, which I may remove or document as I publish this module.
- ~~The whitespace control is currently not supported in the grammar. (I may add it later) Ex. `{{~foo}}` is not supported.~~
- Whitespace control is supported, but is handled by a preprocessor and not the grammar. This nuance probably won't affect you, but it's worth mentioning. (Essentially, the whitespace is stripped before the template is parsed)
- Partials are implemented via a helper rather than dedicated syntax.
- ~~To avoid additional syntax, `as` is not supported in block expressions, I chose to use hash arguments in `with` instead.~~
- `as` is supported in block expressions, however it will incur a performance cost / disable inline optimizations as it will perform a recursive lookup. In spite of the de-optimization, it should still perform quite reasonably.
- `with` supports hash arguments, which allows for more flexibility in how the block is executed.
- Supports an (optimized) Interpreted Mode for both synchronous and asynchronous execution; this means you execute templates in browser contexts that disallow `new Function` or `eval`.

I believe these differences are relatively minor and do not impact most use cases, and should be easy to work aorund, but I might iterate on this in the future.

## Install

To install:

```bash
bun install handlebars-jle
```

### Conditionals

Conditionals are done via the `if` block helper.

```handlebars
{{#if age}}
    {{name}} is {{age}} years old.
{{else}}
    {{name}}'s age is unknown.
{{/if}}
```

There is also support for if/else if chains

```handlebars
{{#if age}}
    {{name}} is {{age}} years old.
{{else if dob}}
    {{name}} was born on {{dob}}.
{{else}}
    {{name}}'s age is unknown.
{{/if}}
```

### Iteration

Iteration is done via block expressions like `#each`, and the block helper is used to define the iteration context.

```handlebars
{{#each kids}}
    {{name}} is {{age}} years old.
{{/each}}
```

Data:

```json
[
    { "name": "John", "age": 5 },
    { "name": "Jane", "age": 7 }
]
```

And over objects,

```handlebars
{{#each kids}}
    {{@key}} is {{this}} years old.
{{/each}}
```

Data:

```json
{
    "John": 5,
    "Jane": 7
}
```

Variable Traversal Syntax is supported with `../` and `@key` and `@index` are supported.

### With

The `with` block helper has been adjusted a bit from the original Handlebars. It now supports hash arguments, which allows for more flexibility in how the block is executed.

```handlebars
{{#with name='John Doe' age=27}}
    {{name}} is {{age}} years old.
{{/with}}
```

### Adding Helpers

You can add helpers by adding methods to the JSON Logic Engine.

```javascript
import { engine, compile } from './handlebars-jle';
engine.addMethod('addOne', ([a]) => a + 1, { sync: true, deterministic: true });


const template = compile('{{addOne age}}');

template({ age: 5 }); // 6
template({ age: 10 }); // 11
```

If your method is synchronous and deterministic (same input always produces the same output, and it will never return a promise), you should specify that in the options. This will allow the engine to optimize the method; and if synchronous, allow it to be used by `compile`

Here is a more interesting example, using async support:

```javascript
import { engine, compileAsync } from './handlebars-jle';


engine.addMethod('fetch', async ([url]) => {
    const response = await fetch(url)
    return response.json()
})

const template = await compileAsync(`{{#each (fetch 'https://jsonplaceholder.typicode.com/users')}}
@{{username}} - {{name}}
{{/each}}`)

template().then(console.log)
```

Would produce:

```plaintext
@Bret - Leanne Graham
@Antonette - Ervin Howell
@Samantha - Clementine Bauch
@Karianne - Patricia Lebsack
@Kamren - Chelsey Dietrich
@Leopoldo_Corkery - Mrs. Dennis Schulist
@Elwyn.Skiles - Kurtis Weissnat
@Maxime_Nienow - Nicholas Runolfsdottir V
@Delphine - Glenna Reichert
@Moriah.Stanton - Clementina DuBuque
```

### Executing Templates

This module supports both a compiled mode and an "interpreted" mode.

The four main methods to used to build a function are:
- `compile`
- `compileAsync`
- `interpreted`
- `interpretedAsync`

For example:

```javascript
const hello = interpreted('Hello, {{name}}!')
const helloAsync = interpretedAsync('Hello, {{name}}!')
const helloCompiled = compile('Hello, {{name}}!')
const helloAsyncCompiled = await compileAsync('Hello, {{name}}!) // compileAsync is a Promise that returns a function; it can pre-process logic and inline it. 
```

Any of these can now be run with:
```javascript
hello('Jesse') // Hello, Jesse!
helloAsync('Bob') // Promise<'Hello, Bob!'>
helloCompiled('Steve') // Hello, Steve!
helloAsyncCompiled('Tara') // Promise<Hello, Tara!>
```

If you have a CSP Policy that prevents you from using `eval` or `new Function`, you must use `interpreted` or `interpretedAsync` over `compile`. 

If you have no async helpers to add to your templates, it's strongly recommended you use the synchronous methods. 

While the compiler / optimizer will make the execution fully synchronous if everything in the template is not async, there is still some overhead in JavaScript engines that slow it down a bit when packing it into a promise, so it should only be used if you've added async helpers to your engine you'd like to use.

### Adding Block Helpers

This needs fleshed out documentation. This needs some explanation because you're able to deeply optimize the block helper in some powerful ways.
