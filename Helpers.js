
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import url from 'url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

/// GLOBAL prototype
Object.prototype.$next = function(f) { return f(this) }

export const GAP = '\t'

export const asString = s => String( isset(s) ? s : '' )
export const textPadStart = (t, pad) => t
	.split('\n')
	.map(s => pad + s)
	.join('\n')


export const fTextPadStart = pad => t => textPadStart(t, pad)

export const isset = (...args) => args
	.every(v => (v !== null) && (v !== undefined))
export const assert = f => { 
	if ( !f ) throw new Error('') 
	return f
}
export const buildLines = (...args) => args
	.flat(1e9)
	.filter(Boolean)
	.join('\n')

export const buildOneLine = (...args) => args
	.flat(1e9)
	.filter(Boolean)
	.join(' ')

export const textToLines = (text, removeEmptyLines = false) => text
	.replace(/[\r\n]/g, '\n')
	.replace(/[\r]/g, '\n')
	.split('\n')
	.filter(t => removeEmptyLines ? t.trim().length : true)

export const buildTable = (text) => {
	let lines = text
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n')
		.split('\n')
		
	for(let i = 0; i < 10; i++) {
		lines = lines.map(l => l.split(`{TD_${i}}`))
		const max = Math.max( ...lines.map(g => g[1] ? g[0].length : -1) )
		lines = lines.map(g => g[1] ? g[0].padEnd(max, ' ') + g[1] : g[0])
	}

	return lines.join('\n')
}

export const aStrListNor = a => a.map(p => p.trim()).filter(Boolean)

export const asBigIntUIntValid = s => {
	const _s = String(s).trim()
	const _bi = BigInt(_s)
	
	assert( _bi >= 0n )
	assert( String(_bi) === _s )
	
	return _bi
}
export const asAddress = s => {
	const _s = asBigIntUIntValid(s)
	assert( _s > 0n )
	return _s
}
export const asUIntValid = s => {
	const _s = String(s).trim()
	const i = _s | 0
	assert( i >= 0 )
	assert( String(i) === _s )
	return i
}
export const asLFIDValid = id => {
	id = asUIntValid(id)
	assert( id > 0 )
	return id
}

export const aUnq = (...args) => [...new Set( args.flat(1e9).filter(Boolean) )]
export const aSub = (a, b) => {
	const sa = new Set( aUnq(b) )
	return aUnq( aUnq(a).filter(c => !sa.has(c)) )
}
export const aIsUnq = (...args) => {
	const a = args.flat(1e9)
	return (new Set( a )).size === a.length
}

export const aLast = a => a[ a.length - 1 ]
export const aFindLastIndex = (a, f) => {
	for(let i = a.length - 1; i >= 0; i--)
		if ( f(a[i], i, a))
			return i
	return -1
}
export const aGroup = (a, fun) => {
	const obj = Object.create(null)
	
	a.map((item, ...args) => {
		const key = fun(item, ...args)
		obj[ key ] = obj[ key ] || []
		obj[ key ].push(item)
	})
	
	return obj
}


export const mObj = o => Object.assign( Object.create(null), o )

export function parseTokens(textOrig) {
	function IDMgr() {
		const sAidMap = Object.create(null)
		return {
			getID: (s) => {
				const id = `ID_FWLMWNQKXOQ_${ getUnqID() }_ID`
				sAidMap[id] = s
				return `\x00${ id }\x00`
			},
			getVal: id => sAidMap[id],
			getValOr: id => getVal(id) ?? id,
		}
	}
	
	const { getID, getVal, getValOr, } = IDMgr()

	let text = textOrig

	const bSymbols = [
		'operator<<',
		'operator>>',
		'operator()',
		'operator[]',
		
		'operator++', 'operator--',
		
		'operator->',
		'operator=',
		'operator==',
		'operator!=',
		
		'operator^=',
		'operator&=',
		'operator|=',
		'operator%=',
		'operator+=', 'operator-=',
		'operator<=', 'operator>=', 'operator+=', 'operator-=', 'operator*=', 'operator/=',
	    'operator<' , 'operator>' , 'operator+' , 'operator-' , 'operator*' , 'operator/' ,
		
		'operator new', 'operator new[]',
		'operator delete', 'operator delete[]',
		
		
		'operator&',
		'operator|',
		'operator!',
		'operator%',
		
		'...',
		'>>=', '<<=',
		'*=', '/=', '+=', '-=',
		'|=', '^=',
		'!=', 
		'"', '\'', '`',
		'::',
		'>>',
		'++', '--',
		
				
		...'<>[](){}@#%^&*+-*/:,~=!|'.split(''),
	]

	text.replace(/\`.*?\'/g, getID)
	bSymbols.map(s => text = text.replaceAll(s, getID) )
	//text = text.replace(/[a-zA-Z_$][a-zA-Z0-9_$]*/g, getID)
	
	const arr = text.split('\x00').filter(Boolean)
	
	const arr2 = arr.map(getValOr)
	
	return arr2
}

function tokensDeep(ps, start = 0, add = +1) {
				let cursor = start
				const gt = () => ps[ cursor   ]
				const rt = () => {
					const ret = ps[ cursor ]
					cursor += add
					return ret 
				}

				const dpMap    = ( add > 0 ) ? 
					Object.assign( Object.create(null), { '(': ')', '[': ']', '{': '}', '<': '>', } ) :
					Object.assign( Object.create(null), { ')': '(', ']': '[', '}': '{', '>': '<', } ) ;
				const dpOpens  = new Set(Object.keys  (dpMap))
				const dpCloses = new Set(Object.values(dpMap))
				
				const deepBlock = []
				const stack = []
				while(1) {
					const c = gt()
					assert( c )
				
					if ( dpOpens .has(c) ) stack.push( dpMap[c] )
					if ( !stack.length )
						return []
					
					deepBlock.push(c)

					if ( dpCloses.has(c) ) assert( c === stack.pop() )
					if ( !stack.length   ) {
						if ( add < 0 )
							return deepBlock.reverse()
						return deepBlock
					}
					rt()
				}
}

export function nameSplitNamespaceEx(textOrig) {
	const toks = parseTokens(textOrig)

	let list = []
	let cur = []
	for(let i = 0; i < toks.length; ) {
		if ( toks[i] === '::' ) {
			if ( !cur.length ) {
				console.log( list )
				console.log( textOrig )
			}
			
			assert( cur.length )
			list.push( cur )
			cur = []
			i++
			continue
		}

		const dp = tokensDeep(toks, i, +1)
		if ( dp.length ) {
			cur.push(dp)
			i += dp.length
			continue
		}
		
		cur.push(toks[i])
		i++
	}
	if ( cur.length )
		list.push(cur)

	list = list.map(c => c.flat(1e9).join(''))
	assert( textOrig === list.join('::') )
	
	return list
	// console.log( list )
}

export function nameSplitNamespace(s) {
	const ps = s
		.replace(/[<>{}()]/g, m => `\x00${m}\x00` )
		.replace(/::/g, m => `\x00${m}\x00` )
		.split('\x00')
		.filter(Boolean)

	let cursor = 0
	const gt = () => ps[ cursor   ]
	const rt = () => ps[ cursor++ ]

	const dpMap    = Object.assign( Object.create(null), { '(': ')', '[': ']', '{': '}', '<': '>', } )
	const dpOpens  = new Set(Object.keys  (dpMap))
	const dpCloses = new Set(Object.values(dpMap))
	function parseDeep() {
		let code = ''
		const stack = []
		while(1) {
			const c = rt()
			assert( c )
			code += c

			if ( dpOpens .has(c) ) stack.push( dpMap[c] )
			if ( dpCloses.has(c) ) assert( c === stack.pop() )
			if ( !stack.length   ) return code
		}
	}

	let code = ''
	while( gt() ) {
		if ( gt() === '::' ) {
			code += '\x00'
			rt()
			continue
		}
		
		code += parseDeep()
	}
	
	const parts = code.split('\x00')
	assert( parts.join('::') === s )
	
	if ( code )
		parts.map(s => assert(s))
	
	return parts
}

export function nameDenormalize(n) {
	return n.replace(/_N([A-F0-9]{2})N_/g, (_, m) => String.fromCharCode( parseInt(m, 16) ) )
}
export function nameNormalize(n) {
	const f = s => s.replace(/[^a-zA-Z0-9_$]/g, c => '_N' + c.charCodeAt().toString(16).padStart(2, '0').toUpperCase() + 'N_')
	const n2 = f(n)
	//assert( n === nameDenormalize(n) )
	//assert( n === nameDenormalize(n2) )
	return n2
}

const __namesFileStorageMap = mObj({})
export function namesFileStorage(name) {
	return __namesFileStorageMap[name] ?? ( __namesFileStorageMap[name] = new Set( 
		textToLines(fs.readFileSync(path.join(__dirname, name), 'utf-8'), true)
			.map(l => l.trim())
			.filter(Boolean)
			.filter(l => !l.startsWith('//')) ) )
}

export function nameNormalizeDefineRules(n) {
	while( namesFileStorage('name-define-list.cfg').has(n) )
		n = n + '_'
	return n
}

export function nameRandom(prefix) {
	if ( !prefix )
		prefix = 'RNAME'
	
	return `$_${ prefix }_${ 'L5LJ6MSDBGZ6H6T7P6' }` /// `${ (Date.now().toString(36) + Math.random().toString(36).slice(3)).toUpperCase() }`
}

const __nameRandomMini_RandPrefix = 'ixhg' /// Math.random().toString(36).slice(3, 3+4)
let __nameRandomMini_NextID = 1
export function nameRandomMini(postfix = '') {
	return `$${ __nameRandomMini_RandPrefix }${ (__nameRandomMini_NextID++).toString(36) }${ postfix ? '_'+postfix : '' }`
}

const startUnqID = 2**30
let __nextUnqID  = startUnqID
export function isFakeID(id) {
	return asLFIDValid(id) >= startUnqID
}
export function getUnqID() {
	return __nextUnqID++
}

export function flagsToString(flags) {
	const _getNames = (flags) => {
		return Object
			.keys(flags)
			.map(n => {
				const name = n
					.split('')
					.map(c => c.toLowerCase() === c ? c : `\x00${c}`)
					.join('')
					.split('\x00')
					.filter(Boolean)
					.join(' ')
					.toUpperCase()
					.replace(/_$/, '')
				return [ name, n ]
			})
	}
	return _getNames(flags)
		.map(n => flags[n[1]] ? n[0] : '')
		.filter(Boolean)
		.join(', ')
}


export function uintToHex(value, options) {
	options = {
		hexPrefix: true,
		upperCase: true,
		padStart : 8 + 2,
		
		...options
	}

	const value_bi = BigInt(value)
	assert( String(value_bi) === String(value) )
	assert( value_bi >= 0n )
	
	let value_hex = value_bi.toString(16)

	if ( options.upperCase )
		value_hex = value_hex.toUpperCase()
	
	if ( options.padStart )
		value_hex = value_hex.padStart(options.padStart, '0')
	
	if ( options.hexPrefix )
		value_hex = '0x' + value_hex
	
	return value_hex
}


export function repeatWhile(fn) {
	let r = fn()
	while(1) {
		const r2 = fn()
		if ( r === r2 )
			return
		r = r2
	}
	
	return r
}

export const buildRowsMaxRow = maxRowLen => {
	const rows = []
	let _curRow = ''
	const _this = {}
	const addCell = cell => {
		if ( _curRow ) {
			if ( _curRow.length + cell.length > maxRowLen ) {
				rows.push( _curRow )
				_curRow = ''
				return addCell(cell)
			}
		}

		_curRow += cell
				
		return _this
	}
			
	return Object.assign(_this, { addCell, getRows: () => [...rows, ...(_curRow ? [_curRow] : [])], } )
}
		

export const bitsWordMgr = (maxWordSize) => {
	const this_ = {}
	
	const words = []
	const setBit = (index, val) => {
		const wordIndex = (index / maxWordSize) | 0
		const bitIndex  = BigInt(index % maxWordSize)

		while( words[wordIndex] === undefined )
			words.push( 0n )
		
		const clearMask = ~(1n << bitIndex)
		const applyMask = (val ? 1n : 0n) << bitIndex
		
		words[ wordIndex ] = (words[ wordIndex ] & clearMask) | applyMask
		
		return this_
	}
	const getBit = index => {
		const wordIndex = (index / maxWordSize) | 0
		const bitIndex  = BigInt(index % maxWordSize)
		return !!( ( words[ wordIndex ] >> bitIndex ) & 1n )
	}
	const getWords = () => [...words]
	
	return Object.assign(this_, { setBit, getBit, getWords, })
}

export const clamp = (min, val, max) => Math.max( min, Math.min( val, max ) )

export const assertInRange = (min, val, max) => ( assert( ( min <= val ) && ( val <= max ) ), val )
export const fAssertInRange = (min, max) => val => assertInRange(min, val, max)

export const binaryWriter = () => {
	let offset = 0
	
	let buf = Buffer.allocUnsafe(64)
	
	const unsignedTypeList = [
		{ name: 'u8' , size: 1 },
		{ name: 'u16', size: 2 },
		{ name: 'u32', size: 4 },
		{ name: 'u64', size: 8 },
	]
	
	const this_ = {}
	
	const checkRealloc = size => {
		let bufSize = buf.length
		while( offset + size > bufSize )
			bufSize += clamp(1024, bufSize, 1024*1024 )

		if ( bufSize === buf.length )
			return
		
		const newBuf = Buffer.allocUnsafe(bufSize)
		buf.copy(newBuf)
		buf = newBuf
	}
	
	unsignedTypeList.map(t => {
		this_[t.name] = val => {
			val = BigInt(val)
			assert(val >= 0n)
			assertInRange(0n, val, (1n << (BigInt(t.size) *  8n)) - 1n)
			checkRealloc(t.size)
			
			for(let i = 0; i < t.size; i++) {
				buf[ offset++ ] = Number(val & 0xFFn)
				val >>= 8n
			}
			
			return this_
		}
	})

	this_.getOffset  = () => offset
	this_.getBuffer  = () => buf.slice(0, offset)
	this_.getU64List = () => {
		const list = []
		for(let i = 0; i < offset; ) {
			let u64 = 0n
			for(let j = 0n; j < 8n; j++, i++)
				u64 |= BigInt(buf[i]) << (j * 8n)
			list.push(u64)
		}
		return list
	}
	return this_
}

export const codeFrame = (parent) => {
		const lines = []
		
		const add = text => lines.push(text)
		const this_ = add
		
		const getParent = () => parent
		const build = () => lines
			.map(l => typeof l === 'function' ? l() : l)
			.$next(buildLines)
		
		const buildRoot = () => getParent() ? getParent().buildRoot() : build()

		const createFileFrame = () => {
			const child = codeFrame(this_)
			lines.push(() => 
				buildLines(
					'#pragma once',
					' ',
					`namespace ATF {`,
					child
						.build()
						.$next(fTextPadStart(GAP)),
					'}'
				) 
			)
			return child
		}
		const createNamespaceFrame = (ns) => {
			const child = codeFrame(this_)
			lines.push(() => 
				buildLines(
					`namespace ${ns} {`,
					child
						.build()
						.$next(fTextPadStart(GAP)),
					'}'
				) 
			)
			return child
		}
		const createPackedFrame = () => {
			const child = codeFrame(this_)
			lines.push(() => 
				buildLines(
					`#pragma pack(push, 1)`,
					child
						.build(),
					`#pragma pack(pop)`,
				) 
			)
			return child
		}
		
		return Object.assign(this_, { add, getParent, build, buildRoot, createFileFrame, createNamespaceFrame, createPackedFrame, })
}

export const hashSHA256 = data =>
	crypto
		.createHash('sha256')
		.update(data)
		.digest('hex')
		.toUpperCase()

export const readFilesDeepInDirFlat = (rootDir, dir = './') => path
	.join(rootDir, dir)
	.$next(fs.readdirSync)
	.map(name => path.join(dir, name))
	.map(name => path.join(rootDir, name)
		.$next(nameAbs => fs.lstatSync(nameAbs)
			.$next(stat => 
				stat.isDirectory() ? readFilesDeepInDirFlat(rootDir, name) : (
					stat.isFile() ? { name, data: fs.readFileSync(nameAbs) } : null ) ) ) )
	.filter(Boolean)
	.flat()
