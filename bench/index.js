import Elastic from 'kbn-handlebars'
import Handlebars from 'handlebars'
import { Handlebars as HBS, AsyncHandlebars as AHBS } from '../index.js'
import { Cases } from '../index.test.js'

const cases = Cases()


Elastic.default.registerHelper('gte', (a, b) => a >= b)
Handlebars.registerHelper('gte', (a, b) => a >= b)

Elastic.default.registerHelper('arr', (...args) => args.slice(0, -1))
Handlebars.registerHelper('arr', (...args) => args.slice(0, -1))
Elastic.default.registerHelper('add', (a, b) => a + b)
Handlebars.registerHelper('add', (a, b) => a + b)

Handlebars.registerHelper('default', (a, b) => a ?? b)
Elastic.default.registerHelper('default', (a, b) => a ?? b)
Handlebars.registerHelper('min', (a, b) => Math.min(a, b))
Elastic.default.registerHelper('min', (a, b) => Math.min(a, b))
Handlebars.registerHelper('max', (a, b) => Math.max(a, b))
Elastic.default.registerHelper('max', (a, b) => Math.max(a, b))
Handlebars.registerHelper('multiply', (a, b) => a * b)
Elastic.default.registerHelper('multiply', (a, b) => a * b)
Handlebars.registerHelper('lowercase', (a) => a.toLowerCase())
Elastic.default.registerHelper('lowercase', (a) => a.toLowerCase())

const AgePartial = '{{#unless age}}You have no age{{^}}You have an age{{/unless}}'
const TestPartial = 'Hello {{name}}!'
const StartupTimePartial = new Date().toISOString()

const hbs = new HBS()
const hbsAsync = new AHBS()
const hbsInterpreted = new HBS({ interpreted: true })

for (const engine of [hbs, hbsAsync, hbsInterpreted]) {
  engine.register('Age', AgePartial)
  engine.register('Test', TestPartial)
  engine.register('StartupTime', StartupTimePartial)
}

Handlebars.registerPartial('Age', AgePartial)
Handlebars.registerPartial('Test', TestPartial)
Handlebars.registerPartial('StartupTime', StartupTimePartial)

Elastic.default.registerPartial('Age', AgePartial)
Elastic.default.registerPartial('Test', TestPartial)
Elastic.default.registerPartial('StartupTime', StartupTimePartial)


const simpleTemplate = 'Hello, {{name}}!'

async function runBench (name, script, data, iter = 1e6) {
    const hbStart = performance.now()
    const template = Handlebars.compile(script, { noEscape: true })
    for (let i = 0; i < iter; i++) template(data(i))
    const hbEnd = performance.now()

    const elasticStart = performance.now()
    const elastic = Elastic.default.compileAST(script, { noEscape: true })
    for (let i = 0; i < iter; i++) elastic(data(i))
    const elasticEnd = performance.now()

    const jleStart = performance.now()
    const jle = hbs.compile(script, { noEscape: true })
    for (let i = 0; i < iter; i++) jle(data(i))
    const jleEnd = performance.now()

    const jleInterpStart = performance.now()
    const jleInterp = hbsInterpreted.compile(script, { noEscape: true })
    for (let i = 0; i < iter; i++) jleInterp(data(i))
    const jleInterpEnd = performance.now()


    const jleAsyncStart = performance.now()
    const jleAsync = hbsAsync.compile(script, { noEscape: true })
    for (let i = 0; i < iter; i++) await jleAsync(data(i))
    const jleAsyncEnd = performance.now()


    // Show relative performance, figure out fastest and slowest
    const hbTime = hbEnd - hbStart
    const elasticTime = elasticEnd - elasticStart
    const jleTime = jleEnd - jleStart
    const jleInterpTime = jleInterpEnd - jleInterpStart


    console.log(`Handlebars ${name}: ${hbTime.toFixed(2)}ms | ${(hbTime / hbTime).toFixed(2)}x`)
    console.log(`Elastic ${name}: ${elasticTime.toFixed(2)}ms | ${(hbTime / elasticTime).toFixed(2)}x`)
    console.log(`JLE Interpreted ${name}: ${jleInterpTime.toFixed(2)}ms | ${(hbTime / jleInterpTime).toFixed(2)}x`)
    console.log(`JLE Async ${name}: ${(jleAsyncEnd - jleAsyncStart).toFixed(2)}ms | ${(hbTime / (jleAsyncEnd - jleAsyncStart)).toFixed(2)}x`)
    console.log(`JLE ${name}: ${jleTime.toFixed(2)}ms | ${(hbTime / jleTime).toFixed(2)}x`)
    console.log('---')

}

await runBench('Simple', simpleTemplate, () => ({ name: 'John' }))
await runBench('SimpleEach', cases.SimpleEach, () => ({ iterator: [1, 2, 3] }))
await runBench('SimpleIf', cases.SimpleIf, () => ({ account: true }))
await runBench('SimpleIf (False)', cases.SimpleIf, () => ({ account: false }))
await runBench('NestedIf', cases.NestedIf, () => ({ account: true, age: 12 }))
await runBench('NestedIf (False)', cases.NestedIf, () => ({ account: false, age: 12 }))
await runBench('NestedIf (18)', cases.NestedIf, () => ({ account: true, age: 18 }))
await runBench('EachStatic', cases.EachStatic, () => ({}))
await runBench('AddExampleWithTraversal', cases.AddExampleWithTraversal, () => ({ addend: 10 }))
await runBench('Example 1', cases.Example, () => (cases.ExampleData))


const template = `
#---
#$in: base/namespace.yaml
#$out: collectors/namespace.yaml
---
$in: base/envvars.yaml
$out: collectors/envvars.yaml
data:
  {{#each $values.globals.env}}
  {{@key}}: "{{this}}"
  {{/each}}
  {{#each globals.env}}
  {{@key}}: "{{this}}"
  {{/each}}
---
$in: base/config.yaml
$out: collectors/config.yaml
data:
  config.json: |-
    {
      {{#each $values.globals.configmap}}
      {{@key}}: "{{this}}"
      {{/each}}
    }
---
$in: base/serviceaccount.yaml
$out: collectors/{{name}}/serviceaccount.yaml
$replace:
  SERVICE_NAME: {{lowercase name}}
---
$in: base/deployment.yaml
$out: collectors/{{name}}/deployment.yaml
$replace:
  SERVICE_NAME: {{lowercase name}}
  SERVICE_COMMAND: {{name}}
  SERVICE_IMAGE: {{default image "redacted.dkr.ecr.us-east-1.amazonaws.com/microservices/collector"}}
  SERVICE_VERSION: {{#if image}}{{default imageTag "latest"}}{{else}}{{lowercase name}}-{{imageTag}}{{/if}}
spec:
  replicas: {{default replicas 1}}
  template:
    spec:
      containers:
        - resources:
            limits:
              cpu: "{{max (min (multiply (default mcpus 100) 5) 2000) 1000}}m"
              memory: "{{min (multiply (default memory 128) 2) 8192}}Mi"
            requests:
              cpu: "{{min (default mcpus 100) 2000}}m"
              memory: "{{min (default memory 128) 8192}}Mi"
          args:
            - node
            - --max-old-space-size={{default memory 128}}
          {{#if env}}
          env:
          {{#each env}}
            - name: {{@key}}
              value: "{{this}}"
            {{/each}}
          {{/if}}
---
$in: base/role.yaml
$out: collectors/{{name}}/role.yaml
$replace:
  SERVICE_NAME: {{lowercase name}}
---
$in: base/rolebinding.yaml
$out: collectors/{{name}}/rolebinding.yaml
$replace:
  SERVICE_NAME: {{lowercase name}}
`

await runBench('YAML', template, () => ({
    name: 'wildFires',
    imageTag: '2712e0c8',
    env: {
      CURRENT_FIRES: 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/USA_Wildfires_v1/FeatureServer/0',
      CURRENT_FIRES_QUERY: '/query?where=1%3D1',
      PERIMETERS_URL: 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/USA_Wildfires_v1/FeatureServer/1'
    },
    memory: 512
}))


const partialTemplate = `
{{>Test name="Jesse"}}
{{>Test name="John"}}
{{>Test name="Bob"}}
{{>Test name=name}}
{{>Age age=true}}
{{>Age age=false}}
{{>StartupTime}}
`

await runBench('Partials', partialTemplate, () => ({ name: 'Dave' }))

const firstLastTemplate = `
{{#each smallArr}}{{#if @first}}[{{/if}}{{.}}{{#if @last}}]{{else}},{{/if}}{{/each}}
{{#each largerArr}}{{#if @first}}[{{/if}}{{.}}{{#if @last}}]{{else}},{{/if}}{{/each}}
`

const arr = [1, 2, 3]
const largerArr = Array.from({ length: 50 }, (_, i) => i + 1)
await runBench('First/Last', firstLastTemplate, () => ({
  smallArr: arr,
  largerArr
}))
