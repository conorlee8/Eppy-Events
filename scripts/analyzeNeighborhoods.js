const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '..', 'public', 'data', 'neighborhoods', 'san-francisco.geojson')
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

console.log(`📊 Total Neighborhoods: ${data.features.length}`)
console.log(`📁 File size: ${(fs.statSync(filePath).size / 1024).toFixed(2)} KB\n`)

console.log('📝 Neighborhood List:')
data.features
  .map(f => f.properties.name)
  .sort()
  .forEach((name, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${name}`)
  })
