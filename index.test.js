
import { compile, compileAsync, interpreted, interpretedAsync, engine } from "./index.js"

engine.addMethod('fetch', async ([url]) => {
    const response = await fetch(url)
    return response.json()
}, { deterministic: true })

engine.addMethod('Woot', () => 'Woot!', { sync: true, deterministic: true })
engine.addMethod('ELEMENT_002', ([data]) => data, { deterministic: true, sync: true })

/**
 * @pineapple_import Set 
 */
export function createSet (...arr) {
    return new Set(arr)
}

/**
 * @pineapple_import Map
 */
export function createMap (obj) {
    return new Map(Object.entries(obj))
}


/**
 * @pineapple_import fib
 */
export function fibGenerator () {
    function* fib () {
        yield 1
        yield 1
        yield 2
        yield 3
        yield 5
        yield 8
        yield 13
    }
    return fib()
}


/**
 * @pineapple_define
 */
export function Cases () {
    return {
'SimpleEach': `{{#each iterator}}
- {{this}}
{{/each}}`,
'EachWithIndex': `{{#each iterator}}
- {{@index}}: {{this}}
{{/each}}`,
'Person': `{{name}} is {{age}} years old.`,
'SimpleIf': `{{#if account}}You have an account!{{else}}You have no account!{{/if}}`,
'SimpleUnless': `{{#unless account}}You have no account!{{else}}You have an account!{{/unless}}`,
'NestedIf': `{{~#if account~}}
    You have an account!
    {{~else if (gte age 18)~}}
    You are an adult, but you have no account!
    {{~else~}}
    You have no account!
{{~/if}}`,
'SimpleWith': `{{#with name='Bob'}}Hi {{name}}!{{/with}}`,
'SimpleWithVar': `{{#with name=(default username email)}}Hi {{name}}!{{/with}}`,
'EachStatic': `{{#each (arr 1 2 3 4 5)}}
- {{this}}
{{/each}}`,
'Match': `{{match x 'a' 1 'b' 2 3}}`,
'MatchHash': `{{match x a=1 b=2 3}}`,
'EmptyWith': `{{#with}}Hi Bob!{{/with}}`,
'Fetch': `{{#each (fetch 'https://jsonplaceholder.typicode.com/users')}}
- @{{username}} - {{name}}
{{/each}}`,
'FetchIterator': `{{#each items}}
- {{get (fetch (cat 'https://jsonplaceholder.typicode.com/users/' this)) 'name'}}
{{/each}}`,
'Example': `<div class="simple-1" style="background-color: blue; border: 1px solid black">
    <div class="colors">
        <span class="hello">Hello {{name}}! <strong>You have {{messageCount}} messages!</strong></span>
        {{#if colors}}
        <ul>
            {{#each colors}}
            <li class="color">{{this}}</li>
            {{/each}}
        </ul>
        {{else}}
        <div>
            No colors!
        </div>
        {{/if}}
    </div>
    <button type="button" class="{{#if primary}}primary{{else}}secondary{{/if}}">Click me!</button>
</div>`,
ExampleData: {
    "name": "George Washington",
    "messageCount": 999,
    "colors": ["red", "green", "blue", "yellow", "orange", "pink", "black", "white", "beige", "brown", "cyan", "magenta"],
    "primary": true,
    "buttonLabel": "Welcome to the wonderful world of templating engines!"
},
'SimpleJSON': `{{json (obj name='John' age=12)}}`,
'SimpleJSON2': `{{json (obj 'name' 'John' 'age' 12)}}`,
'JSONNonDeterministic': `{{json (obj name=fullName age=actualAge 'test' 3)}}`,
'AddExampleWithTraversal': `{{#each (arr 1 2 3 4 5)}}
- {{add this ../addend}}
{{/each}}`,
'ImplicitIterator': `{{#people}}
- {{name}}: {{age}}
{{/people}}`,
'ImplicitBoolean': `{{#account}}You have an account!{{/account}}`,
// Calls the method if the data value is not found for Woot, because it's ambiguous
'Fallthrough': `{{Woot}}`,
'Unescaped': '{{{name}}}',
'RecursiveVarTest': `{{#with name=(default username 'John') city='Austin'}}
{{#each (arr 1 2 3)}}
    - {{rvar 'username'}} {{rvar 'city'}} {{add . (rvar 'user.identity.age')}}
{{/each}}
{{/with}}`,
'HelloDot': `Hello {{.}}!`,
'HelloDotSlashName': `Hello {{./name}}!`,
'HelloThisName': `Hello {{this.name}}!`,
'HelloName': `Hello {{name}}!`,
'WithAsBlock': `{{#with name='John' as |person|}}
{{#with name='Jane' as |otherPerson|}}
{{person.name}}
{{otherPerson.name}}
{{/with}}
{{/with}}`,
'EachAsBlock': `{{#each (arr 1 2 3) as |num x|}}
- {{num}} {{x}}
{{/each}}`,
'NumbersInVariables': 'Hello {{ELEMENT_001}} let us compute {{ELEMENT_002 ELEMENT_003}}',
'StaticInternalIndexAccess': `{{#each (arr 1 2 3)}}
{{#each (arr 4 5 6)}}
{{../@index}} {{../}}
{{/each}}
{{/each}}`,
'InternalIndexAccess': `{{#each iter}}
{{#each (arr 4 5 6)}}
{{../@index}} {{../}}
{{/each}}
{{/each}}`
    }
}


/**
 * @param {string} script 
 * @test #HelloDot, 'John' returns 'Hello John!'
 * @test #HelloDotSlashName, { name: 'John' } returns 'Hello John!'
 * @test #HelloThisName, { name: 'John' } returns 'Hello John!'
 * @test #HelloName, { name: 'John' } returns 'Hello John!'
 * @test #SimpleEach, { iterator: [1, 2, 3] }
 * @test #SimpleEach, { iterator: ['a', 'b', 'c'] }
 * @test #SimpleEach, { iterator: ['a', 'b', 'c', 'd'] }
 * @test #SimpleEach, { iterator: { a: 1, b: 2, c: 3 } }
 * @test #SimpleEach, { iterator: Set(['a', 'b', 'c']) }
 * @test #SimpleEach, { iterator: fib() }
 * @test #EachWithIndex, { iterator: [1, 2, 3] }
 * @test #EachWithIndex, { iterator: ['a', 'b', 'c'] }
 * @test #EachWithIndex, { iterator: { a: 1, b: 2, c: 3 } }
 * @test #EachWithIndex, { iterator: Set(['a', 'b', 'c']) }
 * @test #EachWithIndex, { iterator: fib() }
 * @test #EachWithIndex, { iterator: Map({ John: 12, Susan: 24 }) }
 * @test #Person, { name: 'John', age: 12 }
 * @test #Person, { name: 'Jane', age: 24 }
 * @test #SimpleIf, { account: true }
 * @test #SimpleIf, { account: false }
 * @test #SimpleUnless, { account: true }
 * @test #SimpleUnless, { account: false }
 * @test #NestedIf, { account: true, age: 12 }
 * @test #NestedIf, { account: false, age: 12 }
 * @test #NestedIf, { account: true, age: 18 }
 * @test #NestedIf, { account: false, age: 18 }
 * @test #SimpleWith, { name: 'John' } returns 'Hi Bob!'
 * @test #SimpleWith, { name: 'Jane' } returns 'Hi Bob!'
 * @test #SimpleWithVar, { username: 'John' } returns 'Hi John!'
 * @test #SimpleWithVar, { email: 'j@j.com' } returns 'Hi j@j.com!'
 * @test #EachStatic, {}
 * @test #Match, { x: 'a' } returns '1'
 * @test #Match, { x: 'b' } returns '2'
 * @test #Match, { x: 'c' } returns '3'
 * @test #MatchHash, { x: 'a' } returns '1'
 * @test #MatchHash, { x: 'b' } returns '2'
 * @test #MatchHash, { x: 'c' } returns '3'
 * @test #EmptyWith, {} returns 'Hi Bob!'
 * @test #Example, #ExampleData
 * @test #SimpleJSON returns '{"name":"John","age":12}'
 * @test #SimpleJSON2 returns '{"name":"John","age":12}'
 * @test #JSONNonDeterministic, { fullName: 'John Doe', actualAge: 20 } returns '{"name":"John Doe","age":20,"test":3}'
 * @test #AddExampleWithTraversal, { addend: 10 }
 * @test #ImplicitIterator, { people: [{ name: 'John', age: 12 }, { name: 'Jane', age: 24 }] }
 * @test #Fallthrough returns 'Woot!'
 * @test #Fallthrough, { Woot: 'Yay!' } returns 'Yay!'
 * @test #Unescaped, { name: '<b>John</b>' } returns '<b>John</b>'
 * @test #ImplicitBoolean, { account: true } returns 'You have an account!'
 * @test #RecursiveVarTest, { username: 'Bob', user: { identity: { age: 20 }  } }
 * @test #WithAsBlock returns 'John\nJane\n'
 * @test #EachAsBlock returns '- 1 0\n- 2 1\n- 3 2\n'
 * @test #NumbersInVariables, { ELEMENT_001: 'John', ELEMENT_003: 'Doe' } returns 'Hello John let us compute Doe'
 * @test #StaticInternalIndexAccess
 * @test #InternalIndexAccess, { iter: [1, 2, 3] }
 */
export function Run(script, data) {
    return compile(script, { recurse: false })(data)
}


/**
 * @param {string} script 
 * @test #SimpleEach, { iterator: [1, 2, 3] }
 * @test #SimpleEach, { iterator: ['a', 'b', 'c'] }
 * @test #SimpleEach, { iterator: ['a', 'b', 'c', 'd'] }
 * @test #SimpleEach, { iterator: { a: 1, b: 2, c: 3 } }
 * @test #SimpleEach, { iterator: Set(['a', 'b', 'c']) }
 * @test #SimpleEach, { iterator: fib() }
 * @test #EachWithIndex, { iterator: [1, 2, 3] }
 * @test #EachWithIndex, { iterator: ['a', 'b', 'c'] }
 * @test #EachWithIndex, { iterator: { a: 1, b: 2, c: 3 } }
 * @test #EachWithIndex, { iterator: Set(['a', 'b', 'c']) }
 * @test #EachWithIndex, { iterator: fib() }
 * @test #EachWithIndex, { iterator: Map({ John: 12, Susan: 24 }) }
 * @test #Person, { name: 'John', age: 12 }
 * @test #Person, { name: 'Jane', age: 24 }
 * @test #SimpleIf, { account: true }
 * @test #SimpleIf, { account: false }
 * @test #NestedIf, { account: true, age: 12 }
 * @test #NestedIf, { account: false, age: 12 }
 * @test #NestedIf, { account: true, age: 18 }
 * @test #NestedIf, { account: false, age: 18 }
 * @test #SimpleWith, { name: 'John' } resolves 'Hi Bob!'
 * @test #SimpleWith, { name: 'Jane' } resolves 'Hi Bob!'
 * @test #SimpleWithVar, { username: 'John' } resolves 'Hi John!'
 * @test #SimpleWithVar, { email: 'j@j.com' } resolves 'Hi j@j.com!'
 * @test #EachStatic, {}
 * @test #Match, { x: 'a' } resolves '1'
 * @test #Match, { x: 'b' } resolves '2'
 * @test #Match, { x: 'c' } resolves '3'
 * @test #MatchHash, { x: 'a' } resolves '1'
 * @test #MatchHash, { x: 'b' } resolves '2'
 * @test #MatchHash, { x: 'c' } resolves '3'
 * @test #EmptyWith, {} resolves 'Hi Bob!'
 * @test #Fetch
 * @test #FetchIterator, { items: [1, 3, 5] }
 * @test #FetchIterator, { items: [1, 2] }
 * @test #FetchIterator, { items: { a: 1 } }
 * @test #Example, #ExampleData
 * @test #SimpleJSON resolves '{"name":"John","age":12}'
 * @test #SimpleJSON2 resolves '{"name":"John","age":12}'
 * @test #JSONNonDeterministic, { fullName: 'John Doe', actualAge: 20 } resolves '{"name":"John Doe","age":20,"test":3}'
 * @test #AddExampleWithTraversal, { addend: 10 }
 * @test #ImplicitIterator, { people: [{ name: 'John', age: 12 }, { name: 'Jane', age: 24 }] }
 * @test #Unescaped, { name: '<b>John</b>' } resolves '<b>John</b>'
 * @test #ImplicitBoolean, { account: true } resolves 'You have an account!'
 * @test #WithAsBlock resolves 'John\nJane\n'
 * @test #EachAsBlock resolves '- 1 0\n- 2 1\n- 3 2\n'
 * @test #NumbersInVariables, { ELEMENT_001: 'John', ELEMENT_003: 'Doe' } resolves 'Hello John let us compute Doe'
 * @test #StaticInternalIndexAccess
 * @test #InternalIndexAccess, { iter: [1, 2, 3] }
 */
export async function RunAsync(script, data) {
    return (await compileAsync(script, { recurse: false }))(data)
}


/**
 * @param {string} script 
 * @test #SimpleEach, { iterator: [1, 2, 3] } returns true
 * @test #SimpleEach, { iterator: ['a', 'b', 'c'] } returns true
 * @test #SimpleEach, { iterator: ['a', 'b', 'c', 'd'] } returns true
 * @test #SimpleEach, { iterator: { a: 1, b: 2, c: 3 } } returns true
 * @test #SimpleEach, { iterator: Set(['a', 'b', 'c']) } returns true
 * @test #EachWithIndex, { iterator: [1, 2, 3] } returns true
 * @test #EachWithIndex, { iterator: ['a', 'b', 'c'] } returns true
 * @test #EachWithIndex, { iterator: { a: 1, b: 2, c: 3 } } returns true
 * @test #EachWithIndex, { iterator: Set(['a', 'b', 'c']) } returns true
 * @test #EachWithIndex, { iterator: Map({ John: 12, Susan: 24 }) } returns true
 * @test #Person, { name: 'John', age: 12 } returns true
 * @test #Person, { name: 'Jane', age: 24 } returns true
 * @test #SimpleIf, { account: true } returns true
 * @test #SimpleIf, { account: false } returns true
 * @test #NestedIf, { account: true, age: 12 } returns true
 * @test #NestedIf, { account: false, age: 12 } returns true
 * @test #NestedIf, { account: true, age: 18 } returns true
 * @test #NestedIf, { account: false, age: 18 } returns true
 * @test #SimpleWith, { name: 'John' } returns true
 * @test #SimpleWith, { name: 'Jane' } returns true
 * @test #SimpleWithVar, { username: 'John' } returns true
 * @test #SimpleWithVar, { email: 'j@j.com' } returns true
 * @test #EachStatic, {} returns true
 * @test #Example, #ExampleData returns true
 * @test #AddExampleWithTraversal, { addend: 10 } returns true
 * @test #JSONNonDeterministic, { fullName: 'John Doe', actualAge: 20 } returns true
 * @test #WithAsBlock returns true
 * @test #EachAsBlock returns true
 * @test #NumbersInVariables, { ELEMENT_001: 'John', ELEMENT_003: 'Doe' } returns true
 * @test #StaticInternalIndexAccess returns true
 * @test #InternalIndexAccess, { iter: [1, 2, 3] } returns true
 */
export function RunMethodMatch(script, data) {
    return interpreted(script, { recurse: false })(data) === Run(script, data)
}


/**
 * @param {string} script 
 * @test #SimpleEach, { iterator: [1, 2, 3] } resolves true
 * @test #SimpleEach, { iterator: ['a', 'b', 'c'] } resolves true
 * @test #SimpleEach, { iterator: ['a', 'b', 'c', 'd'] } resolves true
 * @test #SimpleEach, { iterator: { a: 1, b: 2, c: 3 } } resolves true
 * @test #SimpleEach, { iterator: Set(['a', 'b', 'c']) } resolves true
 * @test #EachWithIndex, { iterator: [1, 2, 3] } resolves true
 * @test #EachWithIndex, { iterator: ['a', 'b', 'c'] } resolves true
 * @test #EachWithIndex, { iterator: { a: 1, b: 2, c: 3 } } resolves true
 * @test #EachWithIndex, { iterator: Set(['a', 'b', 'c']) } resolves true
 * @test #EachWithIndex, { iterator: Map({ John: 12, Susan: 24 }) } resolves true
 * @test #Person, { name: 'John', age: 12 } resolves true
 * @test #Person, { name: 'Jane', age: 24 } resolves true
 * @test #SimpleIf, { account: true } resolves true
 * @test #SimpleIf, { account: false } resolves true
 * @test #NestedIf, { account: true, age: 12 } resolves true
 * @test #NestedIf, { account: false, age: 12 } resolves true
 * @test #NestedIf, { account: true, age: 18 } resolves true
 * @test #NestedIf, { account: false, age: 18 } resolves true
 * @test #SimpleWith, { name: 'John' } resolves true
 * @test #SimpleWith, { name: 'Jane' } resolves true
 * @test #SimpleWithVar, { username: 'John' } resolves true
 * @test #SimpleWithVar, { email: 'j@j.com' } resolves true
 * @test #EachStatic, {} resolves true
 * @test #Fetch resolves true
 * @test #FetchIterator, { items: [1, 3, 5] } resolves true
 * @test #FetchIterator, { items: [1, 2] } resolves true
 * @test #FetchIterator, { items: { a: 1 } } resolves true
 * @test #Example, #ExampleData resolves true
 * @test #AddExampleWithTraversal, { addend: 10 } resolves true
 * @test #JSONNonDeterministic, { fullName: 'John Doe', actualAge: 20 } resolves true
 * @test #WithAsBlock resolves true
 * @test #EachAsBlock resolves true
 * @test #NumbersInVariables, { ELEMENT_001: 'John', ELEMENT_003: 'Doe' } resolves true
 * @test #StaticInternalIndexAccess resolves true
 * @test #InternalIndexAccess, { iter: [1, 2, 3] } resolves true
 */
export async function RunMethodAsyncMatch(script, data) {
    return (await interpretedAsync(script, { recurse: false })(data)) === (await RunAsync(script, data))
}