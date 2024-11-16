import Elastic from 'kbn-handlebars'
import Handlebars from 'handlebars'
import { compile, interpreted } from '../index.js'
import { Cases } from '../index.test.js'

const cases = Cases()


Elastic.default.registerHelper('gte', (a, b) => a >= b)
Handlebars.registerHelper('gte', (a, b) => a >= b)

Elastic.default.registerHelper('arr', (...args) => args.slice(0, -1))
Handlebars.registerHelper('arr', (...args) => args.slice(0, -1))
Elastic.default.registerHelper('add', (a, b) => a + b)
Handlebars.registerHelper('add', (a, b) => a + b)


const simpleTemplate = 'Hello, {{name}}!'

function runBench (name, script, data, iter = 1e6) {
    const hbStart = performance.now()
    const template = Handlebars.compile(script, { noEscape: true })
    for (let i = 0; i < iter; i++) template(data(i))
    const hbEnd = performance.now()
    
    const elasticStart = performance.now()
    const elastic = Elastic.default.compileAST(script, { noEscape: true })
    for (let i = 0; i < iter; i++) elastic(data(i))
    const elasticEnd = performance.now()

    const jleStart = performance.now()
    const jle = compile(script)
    for (let i = 0; i < iter; i++) jle(data(i))
    const jleEnd = performance.now()

    const jleInterpStart = performance.now()
    const jleInterp = interpreted(script)
    for (let i = 0; i < iter; i++) jleInterp(data(i))
    const jleInterpEnd = performance.now()

    // Show relative performance, figure out fastest and slowest
    const hbTime = hbEnd - hbStart
    const elasticTime = elasticEnd - elasticStart
    const jleTime = jleEnd - jleStart
    const jleInterpTime = jleInterpEnd - jleInterpStart

    const fastest = Math.min(hbTime, elasticTime, jleTime, jleInterpTime)
    const slowest = Math.max(hbTime, elasticTime, jleTime, jleInterpTime)
    

    console.log(`Handlebars ${name}: ${hbTime.toFixed(2)}ms | ${(slowest / hbTime).toFixed(2)}x`)
    console.log(`Elastic ${name}: ${elasticTime.toFixed(2)}ms | ${(slowest / elasticTime).toFixed(2)}x`)
    console.log(`JLE Interpreted ${name}: ${jleInterpTime.toFixed(2)}ms | ${(slowest / jleInterpTime).toFixed(2)}x`)
    console.log(`JLE ${name}: ${jleTime.toFixed(2)}ms | ${(slowest / jleTime).toFixed(2)}x`)
    console.log('---')

}

runBench('Simple', simpleTemplate, () => ({ name: 'John' }))
runBench('SimpleEach', cases.SimpleEach, () => ({ iterator: [1, 2, 3] }))
runBench('SimpleIf', cases.SimpleIf, () => ({ account: true }))
runBench('SimpleIf (False)', cases.SimpleIf, () => ({ account: false }))
runBench('NestedIf', cases.NestedIf, () => ({ account: true, age: 12 }))
runBench('NestedIf (False)', cases.NestedIf, () => ({ account: false, age: 12 }))
runBench('NestedIf (18)', cases.NestedIf, () => ({ account: true, age: 18 }))
runBench('EachStatic', cases.EachStatic, () => ({}))
runBench('AddExampleWithTraversal', cases.AddExampleWithTraversal, () => ({ addend: 10 }))
runBench('Example 1', cases.Example, () => (cases.ExampleData))