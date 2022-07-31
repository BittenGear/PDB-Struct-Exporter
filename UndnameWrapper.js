
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import url from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

import { assert } from './Helpers.js'

const binFile    = path.join(__dirname, './bin/undname.exe')
const inputFile  = './.undname-input.tmp'
const outputFile = './.undname-output.tmp'
const cacheFile  = './.undname.cache'

let g_Cache = Object.create(null)

try {
	g_Cache = JSON.parse( fs.readFileSync(cacheFile, 'utf-8') )
} catch {}

export const undname = name => {
	if ( g_Cache[ name ] )
		return g_Cache[ name ]

	fs.writeFileSync(inputFile, name)
	
	execSync(`"${ binFile }" "${ inputFile }" > "${ outputFile }"`)
	
	const [ newName, ...lines ] = fs.readFileSync(outputFile, 'utf-8').split(/[\r\n]/)
	assert( !lines.length )
	
	g_Cache[ name ] = newName
	
	fs.writeFileSync(cacheFile, JSON.stringify(g_Cache, 1, 1) )
	
	return newName
}
