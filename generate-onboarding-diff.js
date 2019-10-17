const fs = require('fs')
const diff = require('deep-object-diff').diff

var initialSnapshot = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
var newSnapshot = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))

console.log(diff(initialSnapshot, newSnapshot))
//console.log(newSnapshot)
