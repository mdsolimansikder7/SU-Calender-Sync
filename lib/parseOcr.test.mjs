import { parseOcrText } from './parseOcr.js'

const sample = `
Sunday Monday Tuesday Wednesday Thursday
CSE-2201 Data Structures 09:00-10:30 Room 304 Theory
CSE-2202 Data Structures Lab 09:00-12:00 Lab 2 Lab
Wednesday
CSE-2207 Computer Networks 09:00-10:30 Room 401
Thursday
ENG-2101 Technical Writing 10:00-11:30 Room 108
`

const classes = parseOcrText(sample)
console.log(JSON.stringify(classes, null, 2))
console.log('count', classes.length)
