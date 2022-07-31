
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import url from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

import { assert, asUIntValid, aStrListNor, isset, textToLines,
	mObj,
	parseTokens,
} from '../Helpers.js'
import { LF_Type } from './CV_Types.js'
import { LF_StructFlags, LF_PointerFlags, LF_ModifierFlags, LF_MemberFlags, } from './CV_Models.js'

function lf_ParseOrNullID(str) {
	assert( str.startsWith('0x') )
	return asUIntValid( parseInt(str, 16) )
}
function lf_ParseID(str) {
	const id = lf_ParseOrNullID(str)
	assert( id > 0 )
	return id
}
function lf_ParseType(str) {
	let typeID   = null
	let typeName = null

	str = str.trim()
	if ( str.startsWith('T_') ) {
		typeName = str 
	} else {
		typeID = lf_ParseID(str)
	}

	return { typeID, typeName, }
}
function lf_ParseAddr(str) {
	const [, f, s] = str.match(/^([A-Fa-f0-9]+):([A-Fa-f0-9]+)$/)
	return { f, s }
}

function lf_ValidID(id) {
	id = asUIntValid(id)
	assert( id > 0 )
	return id
}

function lf_TypeScalarNormalize(type, isAssert = true) {
	const map = Object.assign(Object.create(null), {
		LF_CHAR  :   'int8_t',
		LF_SHORT :  'int16_t',
		LF_USHORT: 'uint16_t',
		LF_LONG  :  'int32_t',
		LF_ULONG : 'uint32_t',
		LF_QUAD  :  'int64_t',
		LF_UQUAD : 'uint64_t',
	})
	
	if ( map[type] )
		return map[type]
	
	if ( isAssert )
		assert(false)
	
	return null
}
function lf_ValueScalarNormalize(text, isAssert = true) {
	let value = text
	
	if ( typeof value !== 'number' ) {
		const m = text.trim().match(/^\((.*?)\)\s*([^()]*).*$/)
		if ( m ) {
			const type = m[1]
			value = m[2]
			lf_TypeScalarNormalize(type, isAssert)
		}
		value = value.trim()
	}

	if ( isAssert )
		assert( String(value) === String(value|0) )
	
	return value|0
}
function lf_ValueScalarAsString(text, isAssert = true) {
	let value = text
	
	if ( typeof value === 'string' ) {
		const m = text.trim().match(/^\((.*?)\)\s*([^()]*).*$/)
		if ( m ) {
			const type = m[1]
			value = m[2]
			lf_TypeScalarNormalize(type, isAssert)
			value = value.trim()
			assert( String( BigInt(value) ) === String(value) )
		}
	}
	
	return String(value).trim()
}
/// ####################################################################################################################################
/// ####################################################################################################################################
/// ####################################################################################################################################
/// ####################################################################################################################################
/// ####################################################################################################################################

const extendsEx = (base, ...args_) => {
	return class extends base {
		constructor(...args) {
			super(...args)
			args_.map(A => Object.assign(this, new A(...args)))
		}
	}
}

class LF_Root_ {
	freeze() {
		const freeze = (o) => {
			if ( o === null )
				return

			if ( Array.isArray(o) ) {
				Object.freeze(o)
				o.map(freeze)
				return
			}
			
			if ( typeof o === 'object' ) {
				Object.freeze(o)
				Object.values(o).map(freeze)
				return
			}
		}
		freeze(this)
	}
}

class LF_WithLfType_ extends LF_Root_ {
	lf_type       = ''
	constructor(initData) {
		super(initData)
		this.lf_type = initData.lf_type
	}
}

class LF_Base_ extends LF_WithLfType_ {
	id            = 0
	leaf          = 0
	argumentCount = null
	lfBlockText   = ''

	constructor(initData) {
		super(initData)
		
		this.id            = lf_ValidID(initData.id)
		this.leaf          = lf_ValidID(initData.leaf)
		this.argumentCount = isset(initData.argumentCount) ? asUIntValid(initData.argumentCount) : null
		this.lfBlockText   = initData.lfBlockText
		
		assert( this.lfBlockText )
	}
}

class LF_WithUDT_ {
	udtID = 0

	constructor(initData) {
		this.udtID = asUIntValid(initData.udtID)
	}
}
class LF_WithName_ {
	name = ''
	constructor(initData) {
		this.name = initData.name
		assert( this.name )
		if ( this.name.length < 256 )
			assert( this.name.trim() === this.name )
	}
}
class LF_WithSize_ {
	size = 0
	constructor(initData) {
		this.size = asUIntValid(initData.size)
	}
}
class LF_WithElementType_ {
	elementType = null
	constructor(initData) {
		this.elementType = initData.elementType
	}
}
class LF_WithFlags_ {
	flags = null
	constructor(initData) {
		this.flags = initData.flags
		assert( this.flags )
	}
}
class LF_WithFieldList_ {
	numMembers      = 0
	fieldListTypeID = 0

	constructor(initData) {
		this.fieldListTypeID = asUIntValid(initData.fieldListTypeID)
		this.numMembers      = asUIntValid(initData.numMembers)
	}
}
class LF_WithOffset_ {
	offset = 0
	constructor(initData) {
		this.offset = asUIntValid(initData.offset)
	}
}
class LF_WithMemberIndex_ {
	memberIndex = 0
	constructor(initData) {
		this.memberIndex = asUIntValid(initData.memberIndex)
	}
}
class LF_WithVfptrFunTpID_ {
	vfptrOffset    = null
	functionTypeID = null
	constructor(initData) {
		this.vfptrOffset    = initData.vfptrOffset === null ? null : asUIntValid( initData.vfptrOffset )
		this.functionTypeID = asUIntValid( initData.functionTypeID )
		assert( this.functionTypeID > 0 )
	}
}

export class LF_ENUM extends extendsEx(LF_Base_, LF_WithUDT_, LF_WithSize_, LF_WithName_, LF_WithFieldList_, LF_WithElementType_, LF_WithFlags_) {}
export class LF_STRUCTURE extends extendsEx(LF_Base_, LF_WithUDT_, LF_WithSize_, LF_WithName_, LF_WithFieldList_, LF_WithFlags_) {
	derivationListTypeID = 0
	vtShapeTypeID        = 0

	constructor(initData) {
		super(initData)
		this.derivationListTypeID = asUIntValid(initData.derivationListTypeID)
		this.vtShapeTypeID        = asUIntValid(initData.vtShapeTypeID)
	}
}
export class LF_CLASS extends LF_STRUCTURE {}
export class LF_UNION extends extendsEx(LF_Base_, LF_WithUDT_, LF_WithSize_, LF_WithName_, LF_WithFieldList_, LF_WithFlags_) {
	constructor(initData) {
		super(initData)
	}
}

export class LF_ARRAY extends extendsEx(LF_Base_, LF_WithSize_, LF_WithElementType_) {
	indexType   = null
	
	constructor(initData) {
		super(initData)
		this.elementType = initData.elementType
		this.indexType   = initData.indexType
	}
}
export class LF_POINTER extends extendsEx(LF_Base_, LF_WithSize_, LF_WithElementType_, LF_WithFlags_) {
	containingClassID     = 0
	typeOfPointerToMember = ''

	constructor(initData) {
		super(initData)
		
		this.containingClassID     = asUIntValid(initData.containingClassID)
		this.typeOfPointerToMember = initData.typeOfPointerToMember
	}
}
export class LF_MODIFIER extends extendsEx(LF_Base_, LF_WithElementType_, LF_WithFlags_) {
	
}

export class LF_ARGLIST extends LF_Base_ {
	argTypeList = []
	constructor(initData) {
		super(initData)
		this.argTypeList = initData.argTypeList
	}
}

export class LF_PROCEDURE extends LF_Base_ {
	argTypeListID = 0
	returnType = null
	numParams = 0
	callConvention = ''
	
	constructor(initData) {
		super(initData)
		this.argTypeListID  = initData.argTypeListID
		this.returnType     = initData.returnType
		this.numParams      = asUIntValid(initData.numParams)
		this.callConvention = initData.callConvention
	}
}
export class LF_MFUNCTION extends LF_PROCEDURE {
	classType  = null
	thisType   = null
	thisAdjust = 0
	constructor(initData) {
		super(initData)
		this.classType  = initData.classType
		this.thisType   = initData.thisType
		this.thisAdjust = asUIntValid(initData.thisAdjust)
	}
}

class LF_METHODLIST_ITEM extends extendsEx(LF_Root_, LF_WithVfptrFunTpID_, LF_WithFlags_) {}
export class LF_METHODLIST extends LF_Base_ {
	methodList = []	/// { vfptrOffset, functionTypeID, flags }
	constructor(initData) {
		super(initData)

		this.methodList = initData.methodList
	}
}

export class LF_BITFIELD extends extendsEx(LF_Base_, LF_WithElementType_) {
	bits = 0
	startingPosition = 0
	
	constructor(initData) {
		super(initData)
		this.bits             = asUIntValid(initData.bits)
		this.startingPosition = asUIntValid(initData.startingPosition)
	}
}

export class LF_VTSHAPE extends LF_Base_ {
	vtShapeList = []
	constructor(initData) {
		super(initData)
		this.vtShapeList = initData.vtShapeList
	}
}


class LF_ENUMERATE extends extendsEx(LF_Root_, LF_WithLfType_, LF_WithName_, LF_WithMemberIndex_, LF_WithFlags_)  {
	value       = '0'
	constructor(initData) {
		super(initData)
		this.value       = initData.value
		assert( typeof this.value === 'string' )
		assert( String(BigInt(this.value)) === this.value )
	}
}
class LF_MEMBER extends extendsEx(LF_Root_, LF_WithLfType_, LF_WithName_, LF_WithElementType_, LF_WithOffset_, LF_WithMemberIndex_, LF_WithFlags_)  {
}
class LF_STATICMEMBER extends extendsEx(LF_Root_, LF_WithLfType_, LF_WithName_, LF_WithElementType_, LF_WithMemberIndex_, LF_WithFlags_)  {
}
class LF_ONEMETHOD extends extendsEx(LF_Root_, LF_WithLfType_, LF_WithName_, LF_WithMemberIndex_, LF_WithVfptrFunTpID_, LF_WithFlags_)  {
}
class LF_METHOD extends extendsEx(LF_Root_, LF_WithLfType_, LF_WithName_, LF_WithMemberIndex_) {
	count = 0
	methodListID = 0
	constructor(initData) {
		super(initData)
		this.count = asUIntValid(initData.count)
		this.methodListID = asUIntValid(initData.methodListID)
		assert( this.methodListID > 0 )
	}
}
class LF_NESTTYPE extends extendsEx(LF_Root_, LF_WithLfType_, LF_WithName_, LF_WithMemberIndex_, LF_WithElementType_) {}
class LF_BCLASS extends extendsEx(LF_Root_, LF_WithLfType_, LF_WithMemberIndex_, LF_WithElementType_, LF_WithOffset_, LF_WithFlags_) {}
class LF_VFUNCTAB extends extendsEx(LF_Root_, LF_WithLfType_, LF_WithMemberIndex_, LF_WithElementType_) {}
class LF_VBCLASS extends extendsEx(LF_Root_, LF_WithLfType_, LF_WithMemberIndex_, LF_WithFlags_) {
	vbind  = 0
	vbpoff = 0
	directBaseType = null
	virtualBasePtr = null
	constructor(initData) {
		super(initData)
		
		this.vbind            = asUIntValid(initData.vbind)
		this.vbpoff           = asUIntValid(initData.vbpoff)
		this.directBaseType   = (initData.directBaseType)
		this.virtualBasePtr   = (initData.virtualBasePtr)
	}	
}
class LF_IVBCLASS extends extendsEx(LF_Root_, LF_WithLfType_, LF_WithMemberIndex_, LF_WithFlags_) {
	vbind  = 0
	vbpoff = 0
	indirectBaseType = null
	virtualBasePtr   = null
	constructor(initData) {
		super(initData)
		
		this.vbind            = asUIntValid(initData.vbind)
		this.vbpoff           = asUIntValid(initData.vbpoff)
		this.indirectBaseType = (initData.indirectBaseType)
		this.virtualBasePtr   = (initData.virtualBasePtr)
	}	
}

export class LF_FIELDLIST extends extendsEx(LF_Base_) {
	fieldList = []
	constructor(initData) {
		super(initData)
		this.fieldList = initData.fieldList
	}
}

class LF_PROC_DESC_ARG extends extendsEx(LF_Root_, LF_WithName_, LF_WithElementType_) {
	stackInfo = ''
	constructor(initData) {
		super(initData)
		this.stackInfo = initData.stackInfo
	}
}
class LF_PROC_DESC extends extendsEx(LF_Root_, LF_WithName_) {
	functionTypeID = null
	addr = ''
	argInfoList = []
	info = null
	constructor(initData) {
		super(initData)
		
		this.argInfoList = initData.argInfoList
		this.functionTypeID = initData.functionTypeID
		this.addr = initData.addr
		this.info = initData.info
	}
}

///////////////////////

const parseText_KeyValue = line => line
	.split(',')
	.map(s => s.trim())
	.filter(Boolean)
	.map(s => s.split(' = ').map(c => c.trim()))
	.map(ps => (assert(ps.length === 2), ps))

class LFParser {

	_parse_LfStruct(lfBlock, lines, lfBlockText) {
		const m = lines[0].match(/^\t# members = (\d+),  field list type (0x[0-9a-f]+)(.*)$/)
		let [, numMembers, fieldListTypeID, _lastText] = m
		numMembers |= 0
		let params = _lastText.split(',')
		lines.shift()
		if ( lines[0].startsWith('\t\t') ) {
			params = [...params, ...lines[0].split(',')]
			lines.shift()
		}
		params = aStrListNor(params)
	
		const m2 = lines[0].match(/^\tDerivation list type (0x[0-9a-f]+), VT shape type (0x[0-9a-f]+)$/)
		const [, derivationListType, vtShapeType,] = m2
		lines.shift()
		
		let udtID = 0
		let lineLast = lines[0]
		lines.shift()
		lineLast = lineLast.replace(/, UDT\((0x[0-9a-f]+)\)$/, (_, m) => {
			udtID = lf_ParseOrNullID(m)
			return ''
		})
		
		let size = null
		lineLast = lineLast.replace(/^\tSize = (\d+), class name = /, (_, m) => {
			size = asUIntValid(m)
			return ''
		})
		
		let size_lfType = null
		if ( size === null ) {
			lineLast = lineLast.replace(/^\tSize = \((LF_USHORT|LF_ULONG)\) (\d+), class name = /, (_, lf, m) => {
				size_lfType = lf
				size = asUIntValid(m)
				return ''
			})			
		}
		assert( size !== null )
		
		let name = lineLast
		assert( name )
		assert( name.trim() === name )
		
		const flags = new LF_StructFlags(params)
		
		assert( !lines.length )
		
		fieldListTypeID      = lf_ParseOrNullID(fieldListTypeID)
		const derivationListTypeID = lf_ParseOrNullID(derivationListType)
		const vtShapeTypeID = lf_ParseOrNullID(vtShapeType)
		
		return { ...lfBlock, numMembers, 
			fieldListTypeID, derivationListTypeID, vtShapeTypeID,
			size, size_lfType, name, udtID, flags, lfBlockText,
		}
	}

	_parse_LF_STRUCTURE(lfBlock, lines, lfBlockText) {
		return new LF_STRUCTURE( this._parse_LfStruct(lfBlock, lines, lfBlockText) )
	}
	_parse_LF_CLASS(lfBlock, lines, lfBlockText) {
		return new LF_CLASS( this._parse_LfStruct(lfBlock, lines, lfBlockText) )
	}
	_parse_LF_UNION(lfBlock, lines, lfBlockText) {
		assert( lines.length === 1 )
		
		const m = lines[0].match(/^\t# members = (\d+),  field list type (0x[0-9a-f]+)(.*)$/)
		let [, numMembers, fieldListTypeID, _lastText] = m
		numMembers |= 0
		
		let udt = '0x0'
		_lastText = _lastText.replace(/, UDT\((0x[0-9a-f]+)\)$/, (_, m) => {
			udt = m
			return ''
		})
		
		let [_, _firstText, className,] = _lastText.match(/^(.*?),class name = (.*)$/)
		assert( className )
		assert( className.trim() === className )
		
		const parts = _firstText.split(',').map(s => s.trim()).filter(Boolean)
		const options = {}
		const params = []
		parts.map(s => {
			const ps = s.split(' = ')
			assert( (ps.length === 1) || (ps.length === 2) )
			if ( ps.length === 2 )
				options[ ps[0].trim() ] = ps[1].trim()
			else
				params.push( ps[0].trim() )
		})
		
		assert( options.Size !== undefined )
		
		assert( Object.keys(options).length === 1 )
		
		const flags = new LF_StructFlags(params)
		
		fieldListTypeID = lf_ParseOrNullID(fieldListTypeID)
		const udtID = lf_ParseOrNullID(udt)
		const name = className
		const size = lf_ValueScalarNormalize( options.Size )

		assert( Object.keys(options).length === 1 )

		return new LF_UNION({ ...lfBlock, lfBlockText,
			numMembers, fieldListTypeID, udtID, name,
			flags, size,
		})
	}
	_parse_LF_ENUM(lfBlock, lines, lfBlockText) {
		const m = lines.shift().match(/^\t# members = (\d+),  type = ([^\s]+) field list type (0x[0-9a-f]+)(.*)$/)
		let [, numMembers, type, fieldListTypeID, _lastText] = m
		numMembers |= 0
		assert(!_lastText)
		
		let udtID = 0
		let lineLast = lines.shift()
		assert( !lines.length )
		lineLast = lineLast.replace(/, UDT\((0x[0-9a-f]+)\)$/, (_, m) => {
			udtID = lf_ParseID(m)
			return ''
		})
		
		let [_, _firstText, name,] = lineLast.match(/^(.*?)	enum name = (.*)$/)
		assert( name )
		assert( name.trim() === name )
		
		const params = _firstText.split(',').map(s => s.trim()).filter(Boolean)

		const flags = new LF_StructFlags(params)
		
		type = new LF_Type(type)
		const size = type.size
		fieldListTypeID = lf_ParseOrNullID(fieldListTypeID)

		return new LF_ENUM({ ...lfBlock, elementType: type, fieldListTypeID, numMembers, udtID, name, flags, lfBlockText, size, })
	}

	_parse_LF_ARRAY(lfBlock, lines, lfBlockText) {
		const _tmp = lines.map(l => l.split(' = ').map(s => s.trim()))
		assert( _tmp.length === 4 )
		_tmp.map(p => assert(p.length === 2))
		const _obj = Object.fromEntries(_tmp)
		assert( _obj['Element type'] )
		assert( _obj['Index type'] )
		assert( _obj['length'] )
		assert( _obj['Name'] !== undefined )
		
		assert( _obj['Name'] === '' )	//// ???
		
		return new LF_ARRAY({ ...lfBlock,
			elementType: new LF_Type(_obj['Element type']),
			indexType  : new LF_Type(_obj['Index type']),
			size       : asUIntValid( lf_ValueScalarNormalize( _obj['length'] ) ),
			name       : _obj['Name'],
			lfBlockText,
		})
	}
	_parse_LF_POINTER(lfBlock, lines, lfBlockText) {
		const SP = (s, r) => s.split(r).map(c => c.trim()).filter(Boolean)

		const desc = lines.join('\n')
		
		let line0 = lines.shift()
		assert( line0 )
		const parts = line0.split(',').map(v => v.trim())
		assert( parts.length === 2 )
		
		const [, type] = parts[0].match(/^(.*?) \(__ptr64\)$/)
		assert( type )
		
		const ps2 = parts[1].split(': ')
		assert( ps2.length === 2 )
		assert( ps2[0] === 'Size')
		const size = ps2[1]
		
		let line1 = lines.shift()
		const ps3 = line1.split(',').map(c => c.trim()).filter(Boolean)
		assert( (1 <= ps3.length) && (ps3.length <= 2) )
		
		const [_n, elementType] = ps3[0].trim().split(':').map(s => s.trim())
		assert( _n === 'Element type' )
		assert( elementType )
		
		let containingClass = '0x00'
		if ( ps3[1] ) {
			const ps4 = SP(ps3[1], '=')
			assert( ps4.length === 2 )
			assert( ps4[0] === 'Containing class' )
			containingClass = ps4[1]
		}
		
		let typeOfPointerToMember = null
		const params = []
		let line2 = lines.shift()
		if ( line2 ) {
			const ls = SP(line2, ',')
			assert( (1 <= ls.length) && (ls.length <= 2) )
			let _n
			[_n, typeOfPointerToMember] = SP(ls[0], '=')
			assert( _n === 'Type of pointer to member' )
			assert( typeOfPointerToMember )
			
			if ( ls[1] )
				params.push(ls[1])
		}

		let isConst = false
		let isVolatile = false
		let pt = type
		for(let i = 0; i < 3; i++) {
			pt = pt.replace(/^const\s*/, m => (isConst = true, ''))
			pt = pt.replace(/^volatile\s*/, m => (isVolatile = true, ''))
		}
		let isPointer = pt === 'Pointer'
		let isLvalueReference = pt === 'L-value Reference'
		let isPointerToMemberFunction = pt === 'Pointer to member function'
		let isPointerToMemberData = pt === 'Pointer to member'

		if ( isConst                   ) params.push('const')
		if ( isVolatile                ) params.push('volatile')
		if ( isPointer                 ) params.push('Pointer')
		if ( isLvalueReference         ) params.push('L value Reference')
		if ( isPointerToMemberFunction ) params.push('Pointer To Member Function')
		if ( isPointerToMemberData     ) params.push('Pointer To Member Data')

		const flags = new LF_PointerFlags( params )
		const containingClassID = lf_ParseOrNullID(containingClass)
		
		return new LF_POINTER({ ...lfBlock,
			elementType: new LF_Type(elementType),
			containingClassID, typeOfPointerToMember,
			lfBlockText,
			flags,
			size: 8,
		})
	}
	_parse_LF_MODIFIER(lfBlock, lines, lfBlockText) {
		assert( lines.length === 1 )
		let lastText = lines.shift()
		
		const ps = lastText.split(',')
		assert( ps.length >= 2 )
		
		const sType = ps.pop()
		const [, sType2 ] = sType.trim().match(/modifies type (.*)$/)
		const modifiers = ps.map(s => s.trim())
		
		const flags = new LF_ModifierFlags(modifiers)
		return new LF_MODIFIER({ ...lfBlock, lfBlockText,
			flags, elementType: new LF_Type(sType2.trim()),
		})
	}

	_parse_LF_ARGLIST(lfBlock, lines, lfBlockText) {
		const argTypeList = lines.map((l, i) => {
			const [, ic, type] = l.match(/^\tlist\[(\d+)\] = (.*)$/)
			assert( ic === String(i) )
			
			if ( type === 'T_NOTYPE(0000)' )
				return null
			
			return new LF_Type(type)
		})

		return new LF_ARGLIST({ ...lfBlock, lfBlockText, argTypeList, })
	}
	_parse_LF_PROCEDURE(lfBlock, lines, lfBlockText) {
		let line = lines.shift()
		const [, _returnType, callType, ] = line.match(/^\tReturn type = (.*?), Call type = (.*?)$/)
		
		if ( callType !== 'C Near' ) console.log( callType )
	
		let line2 = lines.shift()
		const [, funcAttr] = line2.match(/^\tFunc attr = (.*)$/)
		if ( funcAttr !== 'none' ) {
		//	console.log( funcAttr )
		//	console.log( lfBlockText )
		}
		//assert( funcAttr === 'none' )
		
		let line3 = lines.shift()
		assert( !lines.length )
		
		let [, numParams, argListType, ] = line3.match(/^\t# Parms = (\d+), Arg list type = (0x[0-9a-f]+)$/i)
		
		numParams = asUIntValid(numParams)
		const returnType = new LF_Type( _returnType )
		const callConvention = callType
		const argTypeListID = lf_ParseID(argListType)
		
		return new LF_PROCEDURE({...lfBlock, lfBlockText,
			returnType, numParams, callConvention, argTypeListID, 
		})
	}
	_parse_LF_MFUNCTION(lfBlock, lines, lfBlockText) {

		const ps = parseText_KeyValue( lines.shift() )
		assert( ps.length === 3 )
		assert( ps[0][0] === 'Return type' )
		assert( ps[1][0] === 'Class type' )
		assert( ps[2][0] === 'This type' )
		
		const returnType = new LF_Type(ps[0][1])
		const classType  = new LF_Type(ps[1][1])
		const _thisType  = (ps[2][1])
		
		const ps2 = parseText_KeyValue( lines.shift() )
		assert( ps2.length === 2 )
		assert( ps2[0][0] === 'Call type')
		assert( ps2[1][0] === 'Func attr' )
		
		const callConvention = ps2[0][1]
		const funcAttr  = ps2[1][1]
		if ( callConvention !== 'C Near' ) console.log( callConvention )
			
		const ps3 = parseText_KeyValue( lines.shift() )
		assert( ps3.length === 3 )
		assert( ps3[0][0] === 'Parms' )
		assert( ps3[1][0] === 'Arg list type' )
		assert( ps3[2][0] === 'This adjust' )
		
		let numParams   = ps3[0][1]
		let argListType = ps3[1][1]
		let thisAdjust  = asUIntValid( parseInt(ps3[2][1], 16) )
		
		assert(_thisType)
		const thisType = _thisType === 'T_NOTYPE(0000)' ? null : new LF_Type(_thisType)
		
		numParams = asUIntValid(numParams)
		const argTypeListID = lf_ParseID(argListType)
		
		assert( !lines.length )
		
		return new LF_MFUNCTION({ ...lfBlock, lfBlockText,
			returnType, classType, thisType, callConvention, numParams, argTypeListID, thisAdjust, 
		})
	}

	_parse_LF_METHODLIST(lfBlock, lines, lfBlockText) {
		const methodList = lines.map((l, i) => {
			let ps = l.split(',').map(s => s.trim()).filter(Boolean)
			const [, ic, visibilityMode] = ps.shift().match(/^list\[(\d+)\] = (.*)$/)
			assert( ic === String(i) )
			
			let vfptrOffset = null
			let argType = null
			ps = ps
				.map(s => s.trim())
				.filter(s => {
					const m = s.match(/^vfptr offset = (.+)$/)
					if ( m ) {
						vfptrOffset = lf_ValueScalarNormalize( m[1] )
						return false
					}
					
					if ( s.startsWith('0x') ) {
						argType = s
						return false
					}
					
					return true
				})
			
			assert( argType )
			
			const functionTypeID = lf_ParseID(argType)
			
			const flags = new LF_MemberFlags([...ps, visibilityMode])

			return new LF_METHODLIST_ITEM({ functionTypeID, vfptrOffset, flags, })
		})
		
		return new LF_METHODLIST({ ...lfBlock, lfBlockText, methodList })
	}

	_parse_LF_BITFIELD(lfBlock, lines, lfBlockText) {
		assert( lines.length === 1 )
		
		const ps = parseText_KeyValue( lines.shift() )
		assert( ps[0][0] === 'bits' )
		assert( ps[1][0] === 'starting position' )
		assert( ps[2][0] === 'Type' )

		const bits             = asUIntValid(ps[0][1])
		const startingPosition = asUIntValid(ps[1][1])
		const elementType      = new LF_Type(ps[2][1])
		
		if ( elementType.typeID ) {
			console.log( lfBlockText )
		}
		
		assert( !elementType.typeID  )
		assert( !elementType.typePtr )
		
		return new LF_BITFIELD({ ...lfBlock, lfBlockText,  bits, startingPosition, elementType, })
	}

	_parse_LF_VTSHAPE(lfBlock, lines, lfBlockText) {
		const [, numberOfEntries] = lines.shift().match(/^\tNumber of entries : (\d+)/)
		assert( lines.length === +numberOfEntries )
		
		const vtShapeList = lines.map((l, i) => {
			const [ic, type] = l.trim().split(':')
			assert( ic === `[${i}]`)
			return type.trim()
		})
		
		return new LF_VTSHAPE({ ...lfBlock, lfBlockText,  vtShapeList, })
	}


	_parse_LF_FIELDLIST(lfBlock, lines, lfBlockText) {
		const fields = []
		let checkIndex = 0
		while( lines.length ) {
			const line = lines[0]
			lines.shift()
			//console.log(line)
			let [, memberIndex, member_lfType, _lastText] = line.match(/^\tlist\[(\d+)\] = (\w+), (.*)$/)
			memberIndex |= 0
			assert( memberIndex === checkIndex++ )
			
			let _attrLine = ''
			if ( lines.length && lines[0].startsWith('\t\t') )
				_attrLine += lines.shift()
			
			let memberName = null
			let name = null
			let options = {}
			let params = []
			let _infoList = []
			
			const parse = s => {
				s = s.replace(/member name = '([^']+)'/, (_, m) => { memberName = m; return '' })
				s = s.replace(/name = '([^']+)'/, (_, m) => { name = m; return '' })
				_infoList.push( ...s.split(',').map(s => s.trim()).filter(Boolean) )
			}
			parse(_lastText)
			parse(_attrLine)
			
			_infoList.filter(i => {
				const kv = i.split(' = ')
				assert( (kv.length === 1) || (kv.length === 2) )
				if ( kv.length === 2 ) {
					options[ kv[0].trim() ] = kv[1].trim()
					return false
				}
				
				params.push(i.trim())
				return true
			})
			
			let member_nestName = ''
			if ( member_lfType === 'LF_NESTTYPE' ) {
				assert( !_attrLine )
				assert( params.length === 1 )
				
				const m = line.match(/^\tlist\[\d+\] = LF_NESTTYPE, type = (.*?), (.*)$/)
				member_nestName = m[2]
				assert( member_nestName )
			}
			
			
			const fParse = () => {
				switch( member_lfType ) {
					case 'LF_ENUMERATE': {
						assert( !memberName )
						assert( name )
						assert( Object.keys(options).length === 1 )
						assert( isset( options.value ) )
						
						const flags = new LF_MemberFlags( params )
						const value = lf_ValueScalarAsString( options.value )
						
						return new LF_ENUMERATE({ name, memberIndex, lf_type: member_lfType, flags, value, })					
					}
					break
				
					case 'LF_MEMBER': {
						assert( memberName )
						assert( !name )
						assert( Object.keys(options).length === 2 )

						const flags = new LF_MemberFlags( params )
						const elementType = new LF_Type(options.type)
						const offset = lf_ValueScalarNormalize( options.offset )
						
						return new LF_MEMBER({ name: memberName, memberIndex, lf_type: member_lfType, flags, elementType, offset, })
					}
					break
					
					case 'LF_STATICMEMBER': {
						assert( memberName )
						assert( !name )
						assert( Object.keys(options).length === 1 )
						
						const flags = new LF_MemberFlags( params )
						const elementType = new LF_Type(options.type)
						
						return new LF_STATICMEMBER({ name: memberName, memberIndex, lf_type: member_lfType, flags, elementType, })
					}
					break
					
					case 'LF_ONEMETHOD': {
						assert( !memberName )
						assert( name )
						
						const flags = new LF_MemberFlags( params )
						
						let   vfptrOffset = null
						if ( options['vfptr offset'] )
							vfptrOffset = lf_ValueScalarNormalize( options['vfptr offset'] )
						
						const functionTypeID = lf_ParseID( options.index )
						
						delete options.index
						delete options['vfptr offset']
						assert( !Object.keys(options).length )
						
						return new LF_ONEMETHOD({ name, memberIndex, lf_type: member_lfType, flags, vfptrOffset, functionTypeID, })
					}
					break
					
					case 'LF_METHOD': {
						assert( !memberName )
						assert( name )
						assert( !params.length )
						assert( Object.keys(options).length === 2 )
						
						const count        = lf_ValueScalarNormalize(options.count)
						const methodListID = lf_ParseID(options.list)
						
						return new LF_METHOD({ name, memberIndex, lf_type: member_lfType,
							count, methodListID, 
						})
					}
					break

					case 'LF_NESTTYPE': {
						assert( !memberName )
						assert( !name )
						assert( member_nestName )
						assert( params.length === 1 )
						assert( Object.keys(options).length === 1 )
						
						const elementType = new LF_Type(options.type)

						return new LF_NESTTYPE({ name: member_nestName, memberIndex, lf_type: member_lfType, 
							elementType,
						})
					}
					
					case 'LF_BCLASS': {
						assert( !memberName )
						assert( !name )
						assert( !member_nestName )
						assert( Object.keys(options).length === 2 )
						
						const flags = new LF_MemberFlags( params )
						
						const elementType = new LF_Type( options.type )
						const offset      = asUIntValid( lf_ValueScalarNormalize( options.offset ) )

						return new LF_BCLASS({ memberIndex, lf_type: member_lfType, 
							elementType, offset, flags,
						})
					}
					break
					
					case 'LF_VFUNCTAB': {
						assert( !memberName )
						assert( !name )
						assert( !member_nestName )
						assert( Object.keys(options).length === 1 )
						assert( !params.length )

						const elementType = new LF_Type(options.type)
						
						return new LF_VFUNCTAB({ memberIndex, lf_type: member_lfType, 
							elementType,
						})
					}
					break
										
					case 'LF_VBCLASS': {
						assert( !memberName )
						assert( !name )
						assert( !member_nestName )
						assert( Object.keys(options).length === 4 )
						
						const flags = new LF_MemberFlags(params)
						const vbind  = asUIntValid( options.vbind )
						const vbpoff = asUIntValid( options.vbpoff )
						const virtualBasePtr = new LF_Type(options['virtual base ptr'])
						
						const directBaseType = new LF_Type(options['direct base type'])
						
						return new LF_VBCLASS({ memberIndex, lf_type: member_lfType, 
							vbind, vbpoff, directBaseType, virtualBasePtr, flags, 
						})
					}
					break

					case 'LF_IVBCLASS': {
						assert( !memberName )
						assert( !name )
						assert( !member_nestName )
						assert( Object.keys(options).length === 4 )
						
						const flags = new LF_MemberFlags(params)
						const vbind  = asUIntValid( options.vbind )
						const vbpoff = asUIntValid( options.vbpoff )
						const virtualBasePtr = new LF_Type(options['virtual base ptr'])
						
						const indirectBaseType = new LF_Type(options['indirect base type'])
						
						return new LF_IVBCLASS({ memberIndex, lf_type: member_lfType, 
							vbind, vbpoff, indirectBaseType, virtualBasePtr, flags, 
						})
					}
					break
					
					default:
						assert( false )
				}
			}
			
			fields.push( fParse() )
		}
	
		return new LF_FIELDLIST({ ...lfBlock, lfBlockText,  fieldList: fields, })
	}


	_parseBlock(block) {
		const lines = block
			.replace(/\r/g, '')
			.split('\n')
			.filter(Boolean)

		const line0 = lines.shift()
		const m = line0.match(/^(0x[0-9a-f]+) : Length = (\d+), Leaf = (0x[0-9a-f]+) (LF_\w+)(.*)$/)
		if ( !m ) throw new Error('')

		let [, id, length, leaf, lf_type, _lastText] = m
		let argumentCount = null

		const m2 = _lastText.match(/^ argument count = (\d+)(.*)$/)
		if ( m2 ) {
			argumentCount = m2[1]|0
			_lastText = m2[2]
		}
		assert( !_lastText )

		id     = lf_ParseID(id)
		leaf   = lf_ParseID(leaf)
		length = asUIntValid(length)

		const lfBlock = { id, length, leaf, lf_type, argumentCount, }
		
		const fn = this[ `_parse_${ lfBlock.lf_type }` ]
		if ( fn )
			return fn.bind(this)(lfBlock, lines, block)
	}

	_parseProc(lines) {
		let [, addr, cb, type, name] = lines.shift().match(/^\([A-Fa-f0-9]+\) S_GPROC32: \[([^\]]+)\], Cb: ([A-Fa-f0-9]+), Type:\s*([^,]+), (.*)$/)
		addr = lf_ParseAddr(addr)
		
		type = ( type === 'T_NOTYPE(0000)' ) ? null : lf_ParseID(type)
		

		const [, parent, end, next] = lines.shift().match(/^\s+Parent: ([A-Fa-f0-9]+), End: ([A-Fa-f0-9]+), Next: ([A-Fa-f0-9]+)$/)

		const [, debugStart, debugEnd] = lines.shift().match(/^\s+Debug start: ([A-Fa-f0-9]+), Debug end: ([A-Fa-f0-9]+)$/)

		let flags = ''
		if ( lines[0] ) {
			const m = lines[0].match(/^\s+Flags: (.*$)$/)
			if ( m ) {
				[, flags] = m
				lines.shift()
			}
		}
		
		let frameProc = null
		if ( lines[0] && lines[0].match(/^\([A-Fa-f0-9]+\)  S_FRAMEPROC:$/) ) {
			lines.shift()
			
			const [, frameSize] = lines.shift().match(/^\s+Frame size = (0x[A-Fa-f0-9]+) bytes$/)
			const [, padSize] = lines.shift().match(/^\s+Pad size = (0x[A-Fa-f0-9]+) bytes$/)
			const [, offsetOfPadInFrame] = lines.shift().match(/^\s+Offset of pad in frame = (0x[A-Fa-f0-9]+)$/)		
			const [, sizeOfCalleeSaveRegisters] = lines.shift().match(/^\s+ Size of callee save registers = (0x[A-Fa-f0-9]+)$/)
			
			let [, addressOfEsceptionHandler] = lines.shift().match(/^\s+Address of exception handler = ([A-Fa-f0-9]+:[A-Fa-f0-9]+)$/)
			addressOfEsceptionHandler = lf_ParseAddr(addressOfEsceptionHandler)
			
			const [, functionInfo] = lines.shift().match(/^\s+Function info: (.*)$/)
			
			frameProc = { frameSize, padSize, offsetOfPadInFrame, sizeOfCalleeSaveRegisters, addressOfEsceptionHandler, functionInfo, }
		}
		
		
		let frameCookie = null
		let argList = []
		if ( lines[0] ) {
			const m = lines[0].match(/^\([A-Fa-f0-9]+\)  S_FRAMECOOKIE: (.*)$/)
			if ( m ) {
				[, frameCookie] = m
				lines.shift()
			}
		}
		
		for(let line; line = lines.shift(); ) {
			const m = line.match(/^\([A-Fa-f0-9]+\)  S_REGREL32: (.*?), Type:\s+([^,]*), (.*)$/)
			if ( !m )
				continue
			
			let [, stackInfo, type, name] = m
			const elementType = new LF_Type(type)
			argList.push(new LF_PROC_DESC_ARG({ stackInfo, name, elementType }))
		}
		
		return new LF_PROC_DESC({ name, argInfoList: argList, addr, functionTypeID: type, info: { 
				addr, cb, name, parent, end, next, debugStart, debugEnd, 
				frameProc,
				frameCookie, 
				flags,
			}
		})

	}
	_parseProcList(text) {
		const lines = textToLines(text, true)

		const blocks = []
		for(let i = 0; i < lines.length; i++) {
			if ( lines[i].match(/^\([A-Z0-9]+\) S_GPROC32: \[/) ) {
				const block = []
				
				while( !/^\([A-Z0-9]+\) S_END$/.test( lines[i] ) ) {
					block.push( lines[i] )
					i++
				}

				blocks.push(block)
			}
		}

		return blocks
			.map(ls => {
				try {
					return this._parseProc([...ls])
				} catch(e) {
					console.log( ls.join('\n') )
					console.log( e )
					console.log( '###############' )
				}
			})
			.filter(Boolean)
	}

	_parseData(text) {
		const list = textToLines(text, true)
			.map(l => l.match(/^S_GDATA32: \[([^\]]+)\], Type:\s*([^,]+), (.*)$/))
			.filter(Boolean)
			.map(m => {
				const toks = parseTokens(m[3])
				const name = toks
					.map(t => ['__ptr64'].includes(t.trim()) ? ' ' : t)
					.join('')

				return {
					addr : lf_ParseAddr(m[1]),
					type : new LF_Type(m[2]),
					name,
				}
			} )
		
		return list
	}

	_parseNameList(text) {
		let list = textToLines(text, true)
			.map(l => l.match(/^S_PUB32: \[([^\]]+)\], Flags: ([a-fA-F0-9]+), (.*)$/))
			.filter(Boolean)
			.map(m => ({
				addr : lf_ParseAddr(m[1]),
				flags: m[2],
				name : m[3],
			}) )

		fs.writeFileSync('./__tmp__input_dump_names.txt', list.map(l => l.name).join('\n'))
		
		execSync(`"${ path.join(__dirname, '../bin/undname.exe') }" __tmp__input_dump_names.txt > __tmp__output_dump_names.txt`)
		
		const list2 = fs.readFileSync('__tmp__output_dump_names.txt', 'utf-8')
			.split(/[\r\n]/)
			.map(s => s.trim())
			.filter(Boolean)
		
		assert( list.length === list2.length )
		
		list.map((l, i) => l.nameFull = list2[i])

		function parseTokens(_line) {
			let line = _line
			const bSymbols = [
				'[]', 
				'>>=', '<<=',
				'*=', '/=', '+=', '-=',
				'|=', '^=',
				'"', '\'', '`',
				'::',
				
				...'<>[](){}@#%^&*+-*/:,'.split(''),
			]
			
			
			let nextID = 1
			const sAidMap = Object.create(null)
			const getID = (s) => {
				const id = `ID_FWLMWNQKXOQ_${nextID++}`
				sAidMap[id] = s
				return `\x00${id}\x00`
			}
			const getVal = id => sAidMap[id] ?? id

			line = line.replace(/\`([^']+)\'/g, getID)
			bSymbols.map((s, i) => line = line.replaceAll(s, getID) )

			assert( line
				.split('\x00')
				.filter(Boolean)
				.map(getVal)
				.join('') === _line )
			
			return line
				.split(/\s/)
				.map(s => s.split('\x00') )
				.flat(1e9)
				.filter(Boolean)
				.map(getVal)
		}
		
		let l1 = list.length
		
		let l5 = 0
		let l6 = 0
		let l7 = 0
		let l8 = 0
		let l9 = 0
		const funcList = []
		list.filter(l => {
			/// адрес в памяти с абсолютным адресом функции
			if ( l.name.startsWith('__imp_') )
				return
			
			let toks = parseTokens(l.nameFull)
			if ( l.nameFull.indexOf('`') !== -1 ) {
				l5++
				return
			}
			
			if ( toks.filter(t => ['operator'].includes(t)).length > 1 )
				return
			
			const ccList = ['__cdecl', '__pascal', '__thiscall', '__stdcall', '__fastcall']
			
			const ignoreWords = ['__ptr64', 'class', 'struct', 'union', 'enum']
			
			toks = toks.filter(t => !ignoreWords.includes(t))
			
			const tl = toks.filter(t => ccList.includes(t)).length
			if ( tl > 1 ) {
			//	console.log(l)
			}
			if ( toks.filter(t => ['operator'].includes(t)).length > 1 )
				console.log(l)
			
			if ( tl )
				l8++
			
			const findDelToken = (flags, tks, ptrn, once = false) => {
				if ( once )
					assert( !flags[ptrn] )
				
				flags[ptrn] = false
				for(let j = 0; 1; j++) {
					const i = tks.findIndex(t => t === ptrn)
					if ( i === -1 )
						break

					assert( once && (j === 0) )
					flags[ptrn] = true
					tks.splice(i, 1)
				}
			}
			const ma = ['public', 'private', 'protected', '__imp_public', '__imp_protected', '__imp_private']
			assert( toks.filter(t => ma.includes(t)).length <= 1 )
			
			const flags = {}
			ma.map(p => findDelToken(flags, toks, p, true))
			if ( flags.__imp_private   ) flags.private   = true /// ??? 
			if ( flags.__imp_protected ) flags.protected = true /// ??? 
			if ( flags.__imp_public    ) flags.public    = true /// ??? 
			
			toks = toks.filter(t => !ma.includes(t))
			
			if ( ma.includes( toks[0] ) )
				l6++

			function deep(ps, start = 0, add = +1) {
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
			
			let thisConst = false
			if ( toks.at(-1) === 'const' ) {
				thisConst = true
				toks.pop()
				assert( toks.at(-1) === ')' )
			}

			if ( toks.at(-1) === ')' ) {
				let argsBlock = deep(toks, toks.length - 1, -1)
				assert( argsBlock.length >= 3 )
				
				toks.splice(toks.length - argsBlock.length)
				
				assert( (argsBlock[0] === '(') && (argsBlock.at(-1) === ')') )
				argsBlock = argsBlock.slice(1, -1)
				if ( argsBlock.length === 1 && argsBlock[0] === 'void' )
					argsBlock = []
				
				
				const tl = toks.filter(t => ccList.includes(t)).length
				assert( tl >= 1 )
				if ( tl > 1 )
					return
				
				l7++
				///console.log(l)
				
				const ccIndex = toks.findIndex(t => ccList.includes(t))
				assert( ccIndex !== -1 )
				
				let nameToks = toks.slice(ccIndex + 1)
				let retToks = toks.slice(0, ccIndex)
				const callConvention = toks[ccIndex]
				
				if ( nameToks.filter(t => ['<', '>'].includes(t)).length ) {
					return
				}
				
				let opName = null
				const opIndex = nameToks.findIndex(t => t === 'operator')
				if ( opIndex !== -1 ) {
					opName = nameToks.slice(opIndex)
					nameToks = nameToks.slice(0, opIndex)
				}
				
				if ( nameToks.at(-1) === ')' )
					return
				
				if ( !nameToks.length )
					return
				
				findDelToken(flags, retToks, 'virtual', true)
				findDelToken(flags, retToks, 'static' , true)
				
				if ( retToks[0] === ':' )
					retToks = retToks.slice(1)
				
				/// console.log( l.nameFull )
				
				nameToks
					.slice(0, -1)
					.filter(t => t !== '::')
					.map(t => assert( t.match(/^[\w_$]+$/) ))
				
				//console.log( nameToks )
				
				let classToks = null
				if ( !opName ) {
					assert( ( nameToks.length === 1 ) || ( nameToks.length >= 3 ) )
					
					if ( nameToks.length > 1 ) {
						assert( nameToks.at(-2) === '::' )
						classToks = nameToks.slice(0, -2)
						opName = nameToks.slice(-1)
					} else {
						opName = nameToks
					}
				} else {
					classToks = nameToks.length ? nameToks : null
				}
				
				assert( opName )
				
				let args = []
				let arg = []
				for(let i = 0; i < argsBlock.length; ) {
					const dp = deep(argsBlock, i, +1)
					if ( dp.length ) {
						//console.log('dp', dp)
						arg.push(dp)
						i += dp.length
						continue
					}

					if ( argsBlock[i] === ',' ) {
						assert( arg.length )
						args.push(arg)
						arg = []
						i++
						continue
					}
					
					arg.push( argsBlock[i] )
					i++
					continue
				}
				if ( arg.length )
					args.push( arg )

				const tokIsWord = t => ( typeof t === 'string' ) && /^[a-z_$][\w_$]+$/i.test(t)
				const tokIsUInt = t => ( typeof t === 'string' ) && ( String(t|0) === t ) && ( t >= 0 )
				const tokOr = (...args) => t => args.some(a => toksIs(a, null)([t]) )
				const toksIs = (...args) => toks => {
					if ( !Array.isArray(toks) )
						return false
					
					return args.every((a, i) => {
						if ( a === null )
							return toks[i] === undefined

						if ( typeof a === 'string' )
							return toks[i] === a
						
						if ( typeof a === 'function' )
							return a(toks[i])
						
						return false
					})
				}
				
				const specExtractPtrArrayLv1 = toks => {
					if ( 
						toksIs( 
							tokIsWord,
							'(', tokOr('*', '&'), ')',
							'[', tokIsUInt, ']',
							//toksIs('(', '*', ')', null),
							//toksIs('[', tokIsUInt, ']', null),
							null
						)( toks )
					) {
						return parseTokens(`$A< ${ toks[0] }, ${ toks[5] } >${ toks[2] }`)
					}
				}
				const normalizeTypes = (_toks) => {
					let toks = [..._toks]
					const mapForce = mObj({
						float : 'float32_t',
						double: 'float64_t',
					})
					const map = mObj({
						char   : 'int8_t' ,
						short  : 'int16_t',
						int    : 'int32_t',
						long   : 'int32_t',
						__int64: 'int64_t',
					})
					
					const words = [Object.keys(mapForce), Object.keys(map), 'unsigned', 'char', ].flat(1e9)
					words.map(w => assert( toks.filter(t => t === w).length <= 1 ) )
					
					const convertType = (type, isUnsigned = false) => {
						if ( mapForce[type] )
							return mapForce[type]
						
						if ( type === 'char' && !isUnsigned )
							return 'char'
						
						let nType = map[type]
						if ( !nType )
							return null
						
						if ( isUnsigned )
							nType = 'u' + nType
						
						return nType
					}
					
					if ( toks[0] === 'unsigned' ) {
						const newType = convertType(toks[1], true)
						assert(newType)
						toks.splice(0, 2, newType)
					} else {
						const newType = convertType(toks[0], false)
						if ( newType )
							toks.splice(0, 1, newType)
					}

					words
						.filter(w => !['char'].includes(w))
						.map(w => assert( toks.filter(t => t === w).length === 0 ) )
					
					toks = toks.flat(1e9).filter(t => !['const'].includes(t))
					
					const newToks = specExtractPtrArrayLv1(toks)
					if ( newToks )
						toks = newToks
						//console.log(newToks)
					
					return toks
				}
				
				args = args.map(normalizeTypes)
				
				funcList.push({ ...l, classToks, nameToks: opName, retToks, callConvention, argsToks: argsBlock, funFlags: flags, 
					argList: args,
					thisConst,
				})
				l9++
			}
			//assert( l.nameFull === toks.join('') )
		})
	
	
		const l2 = list.filter(v => v.nameFull.match(/^(public|private|protected):/)).length
		//const l3 = list.filter(v => v.nameFull.match(/(public|private|protected)/)).length
		
		/// see https://github.com/wine-mirror/wine/blob/master/dlls/msvcrt/undname.c

		const l4 = list.filter(v => v.nameFull.match(/(__cdecl|__pascal|__thiscall|__stdcall|__fastcall)/)).length

		console.log( l1, l2, l4, l5, l6, l7, l8, l9 )
		return { list, funcList }
	}
	
	_parseSectionList(text) {
		const list = textToLines(text, true)
			.map(l => l.match(/^\([a-fA-F0-9]+\) S_SECTION: \[([a-fA-F0-9]+)\], RVA = ([a-fA-F0-9]+), Cb = ([a-fA-F0-9]+), Align = ([a-fA-F0-9]+), Characteristics = ([a-fA-F0-9]+), (.*)$/))
			.filter(Boolean)
			.map(m => ({
				id: m[1],
				rva: m[2],
				cb: m[3],
				align: m[4],
				characteristics: m[5],
				name: m[6],
			}) )
			
		return list
	}

	parse(text) {
		const dataList    = this._parseData(text)
		const nameGroup   = this._parseNameList(text)
		const procList    = this._parseProcList(text)
		const sectionList = this._parseSectionList(text)

		const typeList = text
			.split('\r\n\r\n')
			.filter(s => s.startsWith('0x'))
			.map(block => {
				const lf = this._parseBlock( block )
				if ( lf ) {
					Object.freeze(lf)
					return lf
				}
			})
			.filter(Boolean)
		
		procList.map(v => v.freeze())
		typeList.map(v => v.freeze())
		
		return { dataList, procList, typeList, nameGroup, sectionList, }
	}
	
}

export function lf_Parse(text) {
	return new LFParser().parse( text )
}
