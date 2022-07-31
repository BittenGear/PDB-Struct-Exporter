
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

import { Logger   } from './Logger.js'
import { lf_Parse } from './Parser/CV_Parser.js'
import { lf_Build } from './Builder/Builder.js'
import { lf_AstProcessing } from './Builder/Builder.js'
import { hashSHA256 } from './Helpers.js'
import { cvdump } from './CVDumpWrapper.js'

function Argv(argv) {
	const argMap = new Map(
		argv
		.filter(a => a.startsWith('-'))
		.map(a => a.slice(1).split(':'))
		.map(a => [...a, null].slice(0, 2)) )
		
	const get = (key, fErr) => {
		if ( !argMap.has(key) ) {
			if ( typeof fErr === 'function' )
				return fErr(key)
			return fErr
		}
		
		return argMap.get(key)
	}
	
	return { get }
}

const argv = Argv(process.argv)

const inPdbFile = argv.get('in', () => console.log('Argv (-in:"pdbfile.pdb") not set'))
if ( inPdbFile ) {
	const outDir = argv.get('out', './ATF')

	const logger = new Logger({ dir: path.join(outDir, 'log'), commonFile: 'common.log', firstClear: true, })

	console.log( inPdbFile, outDir )
	
	const pdbHash = fs
		.readFileSync(inPdbFile)
		.$next(hashSHA256)
		.slice(0,8)

	const pdbTextFile = path.join(outDir, `./PDB-${pdbHash}.txt`)
	const pdbJsonFile = path.join(outDir, `./PDB-${pdbHash}.json`)
	
	if ( !fs.existsSync(pdbTextFile) ) {
		console.time("PDB CVDump to text")
			cvdump(inPdbFile, pdbTextFile)
		console.timeEnd("PDB CVDump to text")
	}

	if ( !fs.existsSync(pdbJsonFile) ) {
		console.time("PDB Parsing")
			const pdbRawAst = lf_Parse( fs.readFileSync(pdbTextFile, 'utf-8') )
			fs.writeFileSync(pdbJsonFile, JSON.stringify(pdbRawAst))
		console.timeEnd("PDB Parsing")
	}

	const pdbRawAst = JSON.parse( fs.readFileSync(pdbJsonFile, 'utf-8') )	

	console.time("PDB Build")
		const builderAst = lf_Build(pdbRawAst, logger)
	console.timeEnd("PDB Build")

	console.time("PDB AST Processing")
		lf_AstProcessing(builderAst, logger)
	console.timeEnd("PDB AST Processing")
	
}
