
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import url from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))


import { assert } from './Helpers.js'

const binFile    = path.join(__dirname, './bin/cvdump.exe')

export const cvdump = (pdbFile, outFile) => {
	try {
		fs.mkdirSync(path.dirname(outFile), {recursive: true})
	} catch {}
	
	execSync(`"${ binFile }" "${ pdbFile }" > "${ outFile }"`)	
}
