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
    const jle = compile(script, { noEscape: true })
    for (let i = 0; i < iter; i++) jle(data(i))
    const jleEnd = performance.now()

    const jleInterpStart = performance.now()
    const jleInterp = interpreted(script, { noEscape: true })
    for (let i = 0; i < iter; i++) jleInterp(data(i))
    const jleInterpEnd = performance.now()

    // Show relative performance, figure out fastest and slowest
    const hbTime = hbEnd - hbStart
    const elasticTime = elasticEnd - elasticStart
    const jleTime = jleEnd - jleStart
    const jleInterpTime = jleInterpEnd - jleInterpStart

    const fastest = Math.min(hbTime, elasticTime, jleTime, jleInterpTime)
    const slowest = Math.max(hbTime, elasticTime, jleTime, jleInterpTime)
    

    console.log(`Handlebars ${name}: ${hbTime.toFixed(2)}ms | ${(hbTime / hbTime).toFixed(2)}x`)
    console.log(`Elastic ${name}: ${elasticTime.toFixed(2)}ms | ${(hbTime / elasticTime).toFixed(2)}x`)
    console.log(`JLE Interpreted ${name}: ${jleInterpTime.toFixed(2)}ms | ${(hbTime / jleInterpTime).toFixed(2)}x`)
    console.log(`JLE ${name}: ${jleTime.toFixed(2)}ms | ${(hbTime / jleTime).toFixed(2)}x`)
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

runBench('YAML', template, () => ({
    name: 'wildFires',
    imageTag: '2712e0c8',
    env: {
      CURRENT_FIRES: 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/USA_Wildfires_v1/FeatureServer/0',
      CURRENT_FIRES_QUERY: '/query?where=1%3D1',
      PERIMETERS_URL: 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/USA_Wildfires_v1/FeatureServer/1'
    },
    memory: 512
}))