
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import url from 'url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

import { 
	assert, asUIntValid, asLFIDValid, isset, asBigIntUIntValid, asAddress,
	nameSplitNamespace, nameNormalizeDefineRules, nameRandom, nameNormalize,
	aUnq, aSub, aLast, aFindLastIndex, aGroup, aIsUnq,
	mObj,
	textPadStart, fTextPadStart,
	flagsToString,
	getUnqID, isFakeID,
	buildOneLine, buildLines, buildTable,
	
	parseTokens, nameSplitNamespaceEx,
	nameRandomMini,
	
	uintToHex,
	repeatWhile,
	namesFileStorage,
	
	buildRowsMaxRow,
	bitsWordMgr,
	binaryWriter,
	
	codeFrame,
	hashSHA256, readFilesDeepInDirFlat,
	
	GAP,
} from '../Helpers.js'

import { undname } from '../UndnameWrapper.js'

import { CTypeList, CTypeMap, CCallConventionMap } from '../CTypes.js'

import { cOptBld } from './CodeOptionsBuild.js'

import { Logger } from '../Logger.js'

const lf_CheckLfType   = (node, ...args) => args.flat(1e9).some(t => node.lf_type === t)
const lf_AssertLfType  = (node, ...args) => ( assert(node), assert( lf_CheckLfType(node, ...args) ) )
const lf_NodeInfoToStr = (node) => `[${node.lf_type} ID:${node.id} UDT:${node.udtID}] "${ node.name }"`

const extendsEx = (...args) => {
	class Root {}
	let n = Root
	args
		.flat(1e9)
		.map(a => n = a(n))
	return n
}
const extendsEx2 = (...args) => {
	let n = args.shift()
	args
		.flat(1e9)
		.map(a => n = a(n))
	return n
}



/// ###########################################




/// ###########################################

class Address {
	#sectionID  = null
	#address    = null
	#text       = null
	#rawText    = null
	#absAddress = null

	get sectionID () { return this.#sectionID }
	get address   () { return this.#address }
	get absAddress() { return this.#absAddress }
	get text      () { return `[${ this.#rawText }${ isset(this.absAddress) ? `(${ uintToHex(this.absAddress) })` : '' }]` }

	constructor(addrRaw) {
		this.#sectionID = parseInt(addrRaw.f, 16)
		this.#address   = BigInt(`0x${ addrRaw.s }`)
		this.#text      = `[${ addrRaw.f }:${ addrRaw.s }]`
		this.#rawText   = `${ addrRaw.f }:${ addrRaw.s }`
	}
	
	get addressHex() {
		return uintToHex( this.address )
	}
	get absAddressHex() {
		return uintToHex( this.absAddress )
	}
	
	get addressCode() {
		return `Reflect::BaseAddress + Reflect::Sections[${ this.sectionID }].rva + ${ this.addressHex }`
	}
	
	get absAddressCode() {
		return this.absAddressHex
	}
	
	compare(other) {
		return ( this.sectionID === other.sectionID ) && ( this.address === other.address )
	}
	
	setAbsAddress(addr) {
		this.#absAddress = asAddress(addr)
	}
}

/// ###########################################

class WalkStack extends Array {
	logger = Logger.createEmpty()
	
	static create(logger = Logger.createEmpty()) {
		const w = new WalkStack()
		w.logger = logger
		return w
	}

	add(val) {
		const w = new WalkStack(...this, val)
		w.logger = this.logger
		return w
	}

	get parent() {
		assert( this.length > 0 )
		return this[ this.length - 1 ]
	}
	
	toString() {
		return this.map((n, i) => 
			`${ GAP.repeat(i) }${ n._ }` + (n.nameOrig ? `(${ n.nameOrig })` : '') )
			.join('\n')
	}
}

const Root_ = e => class extends e {
	#instanceofSet = new Set()

	static get _() { return this.name }
	get        _() { return this.constructor.name }	

	check_(...args) {
		return args.flat(1e9).some(v => {
			if ( typeof v === 'string' )
				return this._ === v
			
			return this._ === v._
		})
	}
	assert_(...args) {
		if ( !this.check_(...args) )
			throw new Error(`[${ this._ }] Invalid type. Expected ${ args.map(c => (typeof c === 'string') ? c : c._) }`)
		
		return this
	}
	instanceof_(...args) {
		return args.some(a => this.#instanceofSet.has(a))
	}

	constructor(...args) {
		super(...args)

		const set = new Set()
		let n = this
		while( n ) {
			const c = n.constructor.CLASS
			if ( c !== undefined )
				set.add(c)
			n = n.__proto__
		}
		
		this.#instanceofSet = set
	}
}
const Base_ = e => class extends Root_(class {}) {
	
	#lfNode = null
	get lfNode() { return this.#lfNode }

	constructor(initData) {
		super(initData)
		
		this.#lfNode = ( isset(initData ) && isset( initData.lfNode ) ) ? initData.lfNode : null
	}

	get depsAll   () { throw new Error( `[${ this._ }] Call depsAll` ) }
	get depsDirect() { throw new Error( `[${ this._ }] Call depsDirect` ) }
	get nameID    () { throw new Error( `[${ this._ }] Call nameID` ) }
	get size      () { throw new Error( `[${ this._ }] Call size` ) }
	
	createCode() { throw new Error( `[${ this._ }] Call createCode` ) }
	createCodeFull() { return null }

	compare(other) {
		 throw new Error( `[${ this._ }] Call compare [${ other._ }]` )
	}

	walk(fn, stack) { throw new Error( `[${ this._ }] Call walk\n` + stack.toString() ) }
	
	toString() {
		const ignoreNames = new Set([
			'constructor', 'toString', '__proto__', '_',
			'nameOrigParts', 'nameOrigLocal', 'nameOrigIsUnnamed',
		])
		
		const names = []
		let node = this
		while( node ) {
			names.push( ...Object.getOwnPropertyNames(node).filter(v => {				
				try {
					if ( ignoreNames.has(v) )
						return false
					
					if ( typeof this[v] === 'function' )
						return false
					
					return true
				} catch {}
				return false
			}) )
			node = node.__proto__
		}

		return Object.fromEntries( 
			names
				.map(v => {
					try {
						return [v, this[v]]
					} catch {}
				})
				.filter(Boolean)
		)
	}
}
const LFNode_ = e => class extends e {
	#lfNode = null
	get lfNode() { return this.#lfNode }

	constructor(initData) {
		super(initData)	
		this.#lfNode = ( isset(initData ) && isset( initData.lfNode ) ) ? initData.lfNode : null
	}
}
const ID_ = e => class extends e {
	#id = 0
	
	get id() { return this.#id }
	
	isFakeID() {
		return isFakeID(this.id)
	}

	constructor(initData) {
		super(initData)

		this.#id = asUIntValid( initData.id )
		assert( this.#id > 0 )
	}

	get nameID() {
		return `_NODE_FOWM5SO3_${ this.id.toString(16).padStart(8, 0).toUpperCase() }`
	}

	get ids() { return [ this.id ] }
}
const Name_ = e => class extends e {
	static CLASS = 'Name_'

	#nameOrigParts = []

	get nameOrigParts    () { return [...this.#nameOrigParts] }
	get nameOrig         () { return this.nameOrigParts.join('::') }
	get nameOrigLocal    () { return this.nameOrigParts.slice(-1).join('') }
	get nameOrigIsUnnamed() { return this.nameOrigPartsWithoutUnnamed.length !== this.nameOrigParts.length }	
	get nameOrigPartsWithoutUnnamed() {
		const iarr = ["<unnamed-tag>", "__unnamed", "<unnamed-"]
			.map(n => this.nameOrigParts.findIndex(p => p.startsWith(n) ) )
			.filter(i => i !== -1)
		
		if ( !iarr.length )
			return this.nameOrigParts
		
		return this.nameOrigParts.slice( 0, Math.min( ...iarr ) )
	}

	#nameOverwriteParts = null
	setNameOverwriteParts(parts) {
		this.#nameOverwriteParts = [...parts]
	}
	
	get nameParts    () {
		if ( this.#nameOverwriteParts !== null )
			return [...this.#nameOverwriteParts]
		
		return this.nameOrigParts
	}
	get name         () { return this.nameParts.join('::') }
	get nameLocal    () { return this.nameParts.slice(-1).join('') }

	get nameLocalSafe    () {
		assert( this.nameParts.length === 1 )
		
		return nameNormalizeDefineRules( this.name )
	}

	constructor(initData) {
		super(initData)

		assert( initData.name )
		assert( typeof initData.name === 'string' )

		let _name = initData.name
		if ( _name[0] === '?' )
			_name = undname(_name)

		this.#nameOrigParts = nameSplitNamespaceEx(_name)

		assert( this.nameOrig === _name )
	}
}
const SizeCanZero_ = e => class extends e {
	#size = 0
	get size() { return this.#size }
	constructor(initData) {
		super(initData)
		this.#size = asUIntValid( initData.size )
	}
	
	#sizeWhenNested = null
	get sizeWhenNested() {
		assert( this.#sizeWhenNested !== null )
		return this.#sizeWhenNested
	}
	setSizeWhenNested(size) {
		this.#sizeWhenNested = asUIntValid(size)
	}
	
	get sizeStr() {
		return `Size: ${ this.size }` //  + ( ( this.#sizeWhenNested !== this.size ) ? `(${ this.sizeWhenNested})` : '' )
	}
}
const Size_ = e => class extends SizeCanZero_(e) {
	constructor(initData) {
		super(initData)
		assert( this.size > 0 )
	}
}
const Offset_ = e => class extends e {
	#offset = 0

	get offset() { return this.#offset }

	get offsetStr() {
		return `Offset: ${ this.offset }`
	}

	constructor(initData) {
		super(initData)
		this.#offset = asUIntValid( initData.offset )
	}
}
const ElementType_ = e => class extends e {
	#elementType = null
	
	get elementType() { return this.#elementType }
	
	constructor(initData) {
		super(initData)
		this.#elementType = initData.elementType
		assert( this.#elementType )
	}
	
	get depsAll   () { return this.elementType.depsAll    }
	get depsDirect() { return this.elementType.depsDirect }

	walk(fn, stack = new WalkStack()) {
		fn(this, stack.add(this))
		this.elementType.walk(fn, stack.add(this))
	}
}
const Flags_ = e => class extends e {
	static CLASS = 'Flags_'

	#flags = null
	get flags() { return this.#flags }
	
	get flagsStr() {
		const s = flagsToString(this.flags)
		return s ? `Flags(${ s })` : ''
	}
	
	constructor(initData) {
		super(initData)
		this.#flags = initData.flags
		assert( this.#flags )
		assert( typeof this.#flags === 'object' )
	}
}
const ElementValueInt_ = e => class extends e {
	#value = null
	get value() { return this.#value }
	constructor(initData) {
		super(initData)
		
		assert( String(BigInt(initData.value)) === String(initData.value) )
		
		this.#value = BigInt(initData.value)
	}
}
const UdtID_ = e => class extends e {
	#udtID = 0
	get udtID() { return this.#udtID }

	constructor(initData) {
		super(initData)
		this.#udtID = asUIntValid(initData.udtID)
	}
}
const MemberIndex_ = e => class extends e {
	#memberIndex = 0
	get memberIndex() { return this.#memberIndex }
	
	constructor(initData) {
		super(initData)
		this.#memberIndex = asUIntValid(initData.memberIndex)
	}
}
const VfptrOffset_ = e => class extends e {
	#vfptrOffset = null

	get vfptrOffset  () { return this.#vfptrOffset }
	get isVfptrOffset() { return this.vfptrOffset !== null }

	constructor(initData) {
		super(initData)
		
		this.#vfptrOffset = ( initData.vfptrOffset === null ) ? null : asUIntValid(initData.vfptrOffset)
	}
}
const IsEmptyObject_ = e => class extends e {
	#isEmptyObject = false
	
	get isEmptyObject() { return this.#isEmptyObject }

	constructor(initData) {
		super(initData)
		
		this.#isEmptyObject = !!initData.isEmptyObject
	}
}
const DependOnMe = e => class extends e {
	#dependentOnMeIDSet = new Set()
	get dependentOnMeIDSet() { return new Set([...this.#dependentOnMeIDSet]) }
	addDependentOnMeID(dID) {
		this.#dependentOnMeIDSet.add(dID)
	}
}
const WithAddress_ = e => class extends e {
	static CLASS = 'WithAddress_'

	#address      = null

	get address() { return this.#address }

	setAddress(addrRaw) {
		const address = new Address(addrRaw)
		if ( this.address )
			return assert( this.address.compare(address) )

		this.#address = address
	}
	
	setAbsoluteAddress(addr) {
		assert( this.address ).setAbsoluteAddress(addr)
	}
}
const WithProcInfo_ = e => class extends WithAddress_(e) {
	#procInfo     = null
	#procMiniInfo = null
	get procInfo    () { return this.#procInfo }
	get procMiniInfo() { return this.#procMiniInfo }
	
	setProcInfo(procInfo) {
		this.#procInfo = { ...procInfo }
		this.setAddress(this.procInfo.addr)
	}
	setProcMiniInfo(procMiniInfo) {
		this.#procMiniInfo = { ...procMiniInfo }
		this.setAddress(this.procMiniInfo.addr)
		
		assert( CCallConventionMap[ this.procMiniInfo.callConvention ] === this.elementType.callConvention )
	}

	get argNamePossibleList() {
		return (this?.procInfo?.argInfoList ?? [])
			.map(a => a.name)
	}
}
const ParentNode_ = e => class extends e {
	static CLASS = 'ParentNode_'

	#parentNode = null
	
	get parentNode() { return this.#parentNode }

	setParentNode(node) {
		this.#parentNode = node
	}
	delParentNode() {
		this.#parentNode = null
	}
}
const ChildNodes_ = e => class extends e {
	static CLASS = 'ChildNodes_'
	
	#childNodes = new Set()
	
	get childNodes() { return [...this.#childNodes] }
	
	addChildNode(node) {
		this.#childNodes.add(node)
	}
	delChildNode(node) {
		assert( this.#childNodes.has( node ) )
		this.#childNodes.delete(node)
	}
}
const AutoGenForFwd_ = e => class extends e {
	#autoGenForFwd = false
	get autoGenForFwd() { return this.#autoGenForFwd }

	constructor(initData) {
		super(initData)
		
		this.#autoGenForFwd = !!initData.autoGenForFwd
	}
}
const WithMiss_ = e => class extends e {
	static CLASS = 'WithMiss_'

	#missReasonList = []
	get missReasonList() { return [...this.#missReasonList] }
	
	addMissReason(reason) {
		this.#missReasonList.push(reason)
	}
	
	get isMissInfo() {
		if ( this.missReasonList.length )
			return this.missReasonList.join(', ')
		
		return null
	}
	
	get isMiss() { return !!this.isMissInfo }
}

class TypeVoid extends extendsEx(Base_) {
	get depsAll   () { return [] }
	get depsDirect() { return [] }
	
	createCode() { return 'void' }

	walk(fn, stack) { fn(this, stack.add(this)) }

	compare(other) {
		return this._ === other._
	}
}
class TypeScalar extends extendsEx(Base_, Name_, Size_) {
	constructor(initData) {
		super(initData)
		
		assert( CTypeMap[ this.nameOrig ].size )
	}

	get depsAll   () { return [] }
	get depsDirect() { return [] }
	
	createCode() { return this.nameOrig }
	
	walk(fn, stack) { fn(this, stack.add(this)) }
	
	compare(otherType) {
		if ( this._        !== otherType._        ) return false
		if ( this.nameOrig !== otherType.nameOrig ) return false
		if ( this.size     !== otherType.size     ) return false
		return true
	}
}
class TypeForwardID extends extendsEx(Base_, ID_, SizeCanZero_) {
	#nameForwardOrig = null
	
	get nameForwardOrig() {
		assert( this.#nameForwardOrig !== null )
		return this.#nameForwardOrig
	}
	setNameForwardOrig(n) {
		this.#nameForwardOrig = n
	}
	
	get depsAll   () { return [this.id] }
	get depsDirect() { return [this.id] }
	
	createCode(options, stack) {
		if ( options.typeID_nameForwardOrig )
			return this.nameForwardOrig

		///return this.nameID
		
		return this.name	/// [NAME]
		
		if ( this.isRef ) {
			let parts = []
			
			let n = this.ref
			while(n) {
				parts.unshift( n.nameID )
				n = n.parentNode
			}
			
			return parts.join('::')
		}
		return this.nameID
	}

	walk(fn, stack) {
		fn(this, stack.add(this))
	}
}
class TypeID extends TypeForwardID {
	#ref = null
	
	get ref() {
		assert( this.#ref )
		return this.#ref
	}
	get isRef() { return this.#ref !== null }
	
	setRef(ref) {
		this.#ref = ref
		this.ref
	}

	constructor(initData) {
		super(initData)
		assert( this.size > 0 )
	}

	get name() {
		assert( this.ref )
		return this.ref.name
	}

	compare(other) {
		if ( this._ !== other._ ) return false
		if ( this.id !== other.id ) return false
		return true
	}
}
class TypePadding extends extendsEx(Base_, Size_) {
	get depsAll   () { return [] }
	get depsDirect() { return [] }

	createCodeFull(name, options, stack) {
		return `uint8_t{TD_0} ${ name }[${this.size}]`
	}

	walk(fn, stack) {
		fn(this, stack.add(this))
	}
}

class TypePointerTmp extends extendsEx(Base_, Size_, ElementType_) {
	constructor(initData) {
		super(initData)
		
		this.elementType.assert_(TypeScalar, TypeVoid)
	}

	createCode(options, stack) {
		return this.elementType.createCode(options, stack.add(this)) + '*'
	}
	
	compare(other) {
		if ( this._ !== other._ ) return false
		return this.elementType.compare( other.elementType )
	}
}
class TypePointer extends extendsEx(Base_, ID_, Size_, ElementType_, Flags_) {
	constructor(initData) {
		super(initData)
		
		assert( ['pointer', 'lValueReference', 'pointerToMemberFunction', 'pointerToMemberData'].filter(f => this.flags[f]).length === 1 )
	}

	get depsAll   () { return this.elementType.depsAll }
	get depsDirect() { return [] }
	
	createCode(options, stack) {
		const flags = {...this.flags}

		let tk = this.flags.lValueReference ? '&' : '*'
		
		options = {...options}
		if ( options.typePointer_FirstIgnoreLValueReference )
			tk = '*'
		
		if ( options.typePointer_FirstIgnoreConst )
			delete flags.const_

		delete options.typePointer_FirstIgnoreLValueReference
		delete options.typePointer_FirstIgnoreConst

		const attrCode = []
		if ( flags.const_   ) attrCode.push('const')
		if ( flags.volatile ) attrCode.push('volatile')

		/*
		if ( flags.singleInheritance ) attrCode.push('singleInheritance')
		if ( flags.multipleInheritance ) attrCode.push('multipleInheritance')
		if ( flags.virtualInheritance ) attrCode.push('virtualInheritance')
		if ( flags.mostGeneral ) attrCode.push('mostGeneral')
		if ( flags.pointerToMemberFunction ) attrCode.push('pointerToMemberFunction')
		if ( flags.pointerToMemberData ) attrCode.push('pointerToMemberData')
		*/

		assert( !flags.unaligned )
		//assert( this.flags.const_    )
		//assert( !this.flags.volatile  )
		
		return buildOneLine( this.elementType.createCode(options, stack.add(this)) + tk, attrCode )
	}

	compare(other) {
		if ( this._ !== other._ ) return false
		if ( this.id !== other.id ) return false
		return true
	}
}
class TypeModifier extends extendsEx(Base_, ID_, SizeCanZero_, ElementType_, Flags_) {
	createCode(options, stack) {
		options = {...options}
		
		const flags = {...this.flags}
		if ( options.typeModifier_FirstIgnoreConst )
			delete flags.const_

		delete options.typeModifier_FirstIgnoreConst
		
		return [
				this.elementType.createCode(options, stack.add(this)),
				flags.const_ ? 'const' : '', 
				flags.volatile ? 'volatile' : '',
			]
			.filter(Boolean)
			.join(' ')
	}

	compare(other) {
		if ( this._ !== other._ ) return false
		if ( this.id !== other.id ) return false
		return true
	}
}
class TypeArray extends extendsEx(Base_, ID_, SizeCanZero_, ElementType_, ) {
	#length = 0
	get length() { return this.#length }
	constructor(initData) {
		super(initData)
		this.#length = asUIntValid(initData.length)
		
		assert( this.elementType.size * this.length === this.size )
	}

	createCode(options, stack) {
		assert( this.length > 0 )
		return `$A< ${ this.elementType.createCode(options, stack.add(this)) }, ${ this.length } >`
	}
	
	createCodeFull(name, options, stack) {
		assert( this.length > 0 )
		
		if ( !this.elementType.check_(TypeScalar, TypeID, TypePointer, TypeModifier, TypePointerTmp) )
			return null
		
		return this.elementType.createCode(options, stack.add(this)) + '{TD_0} ' + name + `[${ this.length }]`
	}


	compare(other) {
		if ( this._ !== other._ ) return false
		if ( this.id !== other.id ) return false
		return true
	}
}
class TypeBitfield extends extendsEx(Base_, ID_, ElementType_, ) {
	#startingPosition = 0
	#bits             = 0
	get startingPosition() { return this.#startingPosition }
	get bits            () { return this.#bits }
	constructor(initData) {
		super(initData)

		this.#startingPosition = asUIntValid(initData.startingPosition)
		this.#bits             = asUIntValid(initData.bits)

		this.elementType.assert_( TypeScalar )
		assert( this.elementType.size )
		
		assert( this.bits > 0 )
		assert( this.startingPosition < (this.elementType.size * 8) )
		assert( (this.startingPosition + this.bits) <= (this.elementType.size * 8) )
	}

	get size() { return this.elementType.size }

	createCodeFull(name, options, stack) {
		return this.elementType.createCode(options, stack.add(this)) + '{TD_0} ' + name + '{TD_1} : ' + this.bits
	}
}

class TypeEnum_Member extends extendsEx(Base_, Name_, ElementValueInt_, MemberIndex_, Flags_) {
	createCode(options, stack, elementType) {
		let value = this.value
		if ( value === -2147483648n )
			if ( elementType )
				value = `(${ elementType.createCode(options, stack.add(this)) })${ value }`

		return this.nameLocalSafe + ' = ' + value + ','
	}

	walk(fn, stack = new WalkStack()) {
		fn(this, stack.add(this))
	}
}
class TypeEnum extends extendsEx(Base_, ID_, UdtID_, Name_, Size_, ElementType_, IsEmptyObject_, DependOnMe, ParentNode_, AutoGenForFwd_, WithMiss_, Flags_) {
	#memberList = []
	get memberList() { return [...this.#memberList] }
	
	constructor(initData) {
		super(initData)
		this.#memberList = initData.memberList
		
		this.elementType.assert_(TypeScalar)
	}
	
	get depsDirect() { return [] }

	#isEnumClass = false
	get isEnumClass() { return this.#isEnumClass }

	setIsEnumClass(fl) {
		this.#isEnumClass = !!fl
	}

	createCode(options = {}, stack = new WalkStack()) {
		let code = ''
		code += ( '/// ' + 'enum' + ' ' + this.nameOrig + '\n' )
		code += ( `/// ${ this.sizeStr } ${ this.flagsStr }` + '\n' )
		if ( this.isMiss ) {
			code += `/// Remove type (${ this.isMissInfo })`
			return code
		}
		
		if ( this.autoGenForFwd )
			code += `/// Auto gen empty object for forward \n`
		code += 'enum ' + ( this.isEnumClass ? 'class ' : '' ) + this.nameLocal + ' : ' + this.elementType.createCode(options, stack.add(this)) 	/// [NAME]
		code += ' {' + '\n'
		
		code += buildTable( textPadStart(this.memberList.map(m => m.createCode(options, stack.add(this), this.elementType)).join('\n'), GAP) )
		
		code += '\n};'
		
		return code
	}

	walk(fn, stack = new WalkStack()) {
		fn(this, stack.add(this))
		this.memberList.map(m => m.walk(fn, stack.add(this)))
	}
}

class TypeStruct_DataMember extends extendsEx(Base_, Name_, Offset_, ElementType_, MemberIndex_, Flags_) {
	get isMiss() {
		if ( this.elementType._ === 'TypeArray' )
			if ( this.elementType.length === 0 )
				return true

		return false
	}
	createCode(options, stack) {
		const comment = '/// ' + [this.offsetStr, '{TD_6}', this.flagsStr, '{TD_7}', '"' + this.nameOrig + '"']
			.filter(Boolean)
			.join(' ')

		if ( this.elementType._ === 'TypeArray' ) {
			if ( this.elementType.length === 0 ) {
				stack.logger.group('struct_remove_data_member').log( 'Cancel member, invalid array length(zero length)\n' +
					textPadStart( stack.add(this).toString(), GAP ) )

				return comment + ' Skip member "'+this.nameLocalSafe+'", reasons: invalid array length(zero length)'
			}
		}
		
		const postComment = []
		if ( this.elementType.check_(TypePointer) ) {
			if ( this.elementType.flags.lValueReference ) {
				options = {...options, typePointer_FirstIgnoreLValueReference: true, }
				postComment.push('[replace & to * in pointer type]')
				stack.logger.group('struct_data_member_replace_pointer_type').log( 'Replace & to * in pointer type\n' +
					textPadStart( stack.add(this).toString(), GAP ) )
			}
			if ( this.elementType.flags.const_ ) {
				options = {...options, typePointer_FirstIgnoreConst: true, }
				postComment.push('[cancel const in pointer type]')
				stack.logger.group('struct_data_member_cancel_pointer_type').log( 'Cancel const in pointer type\n' +
					textPadStart( stack.add(this).toString(), GAP ) )
			}
		}
		
		if ( this.elementType.check_(TypeModifier) ) {
			if ( this.elementType.flags.const_ ) {
				options = {...options, typeModifier_FirstIgnoreConst: true, }
				postComment.push('[cancel const modifier]')
				stack.logger.group('struct_data_member_cancel_modifier').log( 'Cancel const modifier\n' +
					textPadStart( stack.add(this).toString(), GAP ) )
			}
		}

		let code = this.elementType.createCodeFull(this.nameLocalSafe, options, stack.add(this))
		if ( !code )
			code = this.elementType.createCode(options, stack.add(this)) + '{TD_0} ' + this.nameLocalSafe
		
		return code + ';{TD_5} ' + buildOneLine(comment, postComment)
	}

	get size() {
		return this.elementType.size
	}
}
class TypeStruct_StaticDataMember extends extendsEx(Base_, Name_, ElementType_, MemberIndex_, WithAddress_, WithMiss_, Flags_) {
	createCode(options, stack) {
		const comment = '/// ' + ['{TD_6}', this.flagsStr, '{TD_7}', this.address ? this.address.text : '', '"' + this.nameOrig + '"']
			.filter(Boolean)
			.join(' ')

		if ( this.isMiss )
			return comment + ` Skip member "${ this.nameOrig }" (${ this.isMissInfo })`
		
		let code = 'static ' + this.elementType.createCode(options, stack.add(this)) + '&{TD_0} ' + this.name
		
		return code + ';{TD_5} ' + comment
	}
	
	createCodeImplementation(options, stack, namePrefix = '') {
		if ( this.isMiss )
			return ''
		
		const typeName = [namePrefix, this.name]
			.filter(Boolean)
			.join('::')

		const codeType = this.elementType.createCode(options, stack.add(this))
		return codeType + '&{TD_0} ' + typeName + 
			`{TD_1} = *${ cOptBld.castType(codeType+'*', cOptBld.castAddr(this.address) ) };`
	}
}
class TypeStruct_FuncMember extends extendsEx(Base_, Name_, ElementType_, MemberIndex_, VfptrOffset_, WithProcInfo_, WithMiss_, Flags_) {
	constructor(initData) {
		super(initData)
		
		this.elementType.assert_(TypeMFunction)

		assert( this.elementType.thisType ? !this.flags.static         : this.flags.static         )
		assert( this.flags.static         ? !this.elementType.thisType : this.elementType.thisType )
	}
	
	setProcMiniInfo(procMiniInfo) {
		super.setProcMiniInfo(procMiniInfo)
		assert( CCallConventionMap[ this.procMiniInfo.callConvention ] === this.elementType.callConvention )
	}
	
	get depsAll() {
		if ( this.isMiss )
			return []
		
		return super.depsAll
	}
	
	
	get argNamePossibleList() {
		return super
			.argNamePossibleList
			.slice( this.flags.static ? 0 : 1 )
	}
	
	createCodeAnon(options, stack) {
		assert( !this.isMiss )
		
		return this.elementType.createCode(options, stack.add(this))
	}
	createCode(options, stack) {
		this.elementType.assert_( TypeMFunction )
		
		const comment = buildOneLine(
			'///', '{TD_6}', 
			this.flagsStr, 
			'{TD_7}', 
			this.isVfptrOffset ? 'VFPtrOffset: ' + this.vfptrOffset : '',
			this.address ? this.address.text : '',
			'"' + this.nameOrig + '"'
		)

		if ( this.isMiss ) {
			const missInfo = `Remove member function "${ this.nameOrig }" (${ this.isMissInfo })`
			return buildOneLine( comment, missInfo )
		}

		return buildLines(
			comment, 
			this.elementType.createCode_MethodHeader(options, stack.add(this), this.name, this.argNamePossibleList)
		)
	}
	
	_createCodeImplementation(options, stack, namePrefix, absAddress) {
		const name = [namePrefix, this.name]
			.flat(1e9)
			.filter(Boolean)
			.join('::')

		return buildTable( this.elementType.createCode_MethodSource(options, stack.add(this), {
			name, 
			argNamePossibleList: this.argNamePossibleList,
			absAddress,
		}) )
		
	}
	createCodeImplementation(options, stack, namePrefix) {
		return this._createCodeImplementation(options, stack, namePrefix, cOptBld.castAddr(this.address) )
	}

	createCodeImplementationVirt(options, stack, namePrefix) {
		const vIndex = (this.vfptrOffset / 8) | 0
		assert( vIndex * 8 === this.vfptrOffset )
		
		const c = this.elementType.thisIsConst ? ' const': ''
		return this._createCodeImplementation(options, stack, namePrefix,
			`( ${ cOptBld.castType(`void${c}*${c}*${c}*${c}`, 'this') } )[0][${ vIndex }]` )
	}
	
}
class TypeStruct_Nesttype extends extendsEx(Base_, Name_, ElementType_, MemberIndex_) {}

class TypeStruct_DataMember_Group extends extendsEx(Base_, Offset_) {
	#list = []
	get list() { return [...this.#list] }

	constructor(initData) {
		super(initData)
		this.#list = initData.list
		
		assert( this.list.length > 0 )
	}
}
class TypeStruct_DataMember_Group_Bitfield extends TypeStruct_DataMember_Group {
	constructor(initData) {
		super(initData)
		
		this.list.map(t => t.assert_(TypeStruct_DataMember))
		this.list.map(t => t.elementType.assert_(TypeBitfield))
		this.list.map(t => t.elementType.elementType.assert_(TypeScalar))
		this.list.map(t => assert( t.elementType.elementType.size === this.list[0].elementType.elementType.size ))
		
		let offset = 0
		this.list.map(t => {
			assert( offset === t.elementType.startingPosition )
			offset += t.elementType.bits
		})
		assert( offset <= (this.list[0].elementType.elementType.size*8) )
	}
	
	get size() {
		return this.list[0].elementType.elementType.size
	}


	
	createCode(options, stack) {
		let membrCode = []
		
		const hasStructWrapper = stack.parent.check_(TypeStruct_DataMember_ViewUnion)
		//if ( hasStructWrapper ) membrCode.push('struct {')
		
		for(const m of this.list)
			membrCode.push( textPadStart( m.createCode(options, stack.add(this)), hasStructWrapper ? GAP : '' ) )

		//if ( hasStructWrapper ) membrCode.push('};')
		
		return membrCode.join('\n')
	}
}

class ViewBaseList extends extendsEx2(Array, Root_) {
	get last  () { assert( this.length > 0 ); return this[ this.length - 1 ] }
	get offset() { assert( this.length > 0 ); return Math.min( ...this.map(m => m.offset) ) }
	get size  () { assert( this.length > 0 ); return Math.max( ...this.map(m => m.offset + m.size) ) - this.offset }
	valid() {
		assert( this.length > 0 )
		let offset = -1
		this.map(m => m.valid && m.valid())
		this._valid()
	}
	

	createCode(options, stack, name) {
		const isRoot = !stack.parent.check_(TypeStruct_DataMember_ViewStruct, TypeStruct_DataMember_ViewUnion)
		
		let membrCode = []
		membrCode.push( isRoot ? '' : name+` {`)
		
		for(const m of this) {
			membrCode.push( 
				textPadStart(m.createCode(options, stack.add(this)), isRoot ? '' : GAP) 
			)
		}
				
		membrCode.push( isRoot ? '' : `};`)
		
		return buildTable( buildLines( membrCode ) )
	}

	walk(fn, stack = new WalkStack()) {
		fn(this, stack.add(this))
		this.map(v => fn(v, stack.add(this)))
	}
}
class TypeStruct_DataMember_ViewStruct extends ViewBaseList {
	_valid() {
		let offset = -1
		this.map(m => {
			assert( offset <= m.offset )
			offset = m.offset + m.size
		})
	}
	
	createCode(options, stack) {
		return super.createCode(options, stack, 'struct')
	}
}
class TypeStruct_DataMember_ViewUnion extends ViewBaseList {
	_valid() {
		const offset = this[0].offset
		this.map(m => assert( offset === m.offset ))
	}
	
	createCode(options, stack) {
		return super.createCode(options, stack, 'union')
	}
}

const TypeStructInfoImmutable_ = e => class extends e {
	#isVbIvbClass = false
	get isVbIvbClass() { return this.#isVbIvbClass }
	
	#vFuncTab             = null
	#vtShapeList          = null
	get vFuncTab            () { return this.#vFuncTab }
	get vtShapeList         () { return this.#vtShapeList ? [...this.#vtShapeList] : null }
	
	#parentTypeList = []
	get parentTypeList    () { return [...this.#parentTypeList] }
	get parentTypeSortList() { return this.parentTypeList.sort((l, r) => l.offset - r.offset) }

	#dataMemberList = []
	get dataMemberList() { return [...this.#dataMemberList] }
	get hasDataMember () { return this.dataMemberList.length !== 0 }
	
	#attrFlags = new Set()
	get attrFlags() { return new Set([...this.#attrFlags]) }
	
	#nestTypeList         = []
	get nestTypeList        () { return [...this.#nestTypeList] }
	
	#staticDataMemberList = []

	#funcMemberList       = []
	
	get staticDataMemberList() { return [...this.#staticDataMemberList] }
	get funcMemberList      () { return [...this.#funcMemberList] }
	
	get methodList      () { return this.funcMemberList.filter(f => !f.flags.static) }
	get staticMethodList() { return this.funcMemberList.filter(f =>  f.flags.static) }
	
	constructor(initData) {
		super(initData)
		
		this.#isVbIvbClass = !!initData.isVbIvbClass
		
		this.#vFuncTab    = !!initData.vFuncTab
		this.#vtShapeList = initData.vtShapeList
		
		if ( this.vFuncTab )
			assert( this.vtShapeList )
		
		this.#parentTypeList = [...initData.parentTypeList]
		this
			.parentTypeList
			.map(t => t.offset)
			.map((o, i, arr) => assert( arr.filter(o2 => o2 === o).length === 1 ) )

		this.#dataMemberList = [...initData.dataMemberList]
		this
			.dataMemberList
			.map(t => t.memberIndex)
			.map((o, i, arr) => assert( arr.filter(o2 => o2 === o).length === 1 ) )
			
		this.#attrFlags = initData.attrFlags
		
		this.#nestTypeList   = initData.nestTypeList
		
		this.#staticDataMemberList = initData.staticDataMemberList
		
		this.#funcMemberList = initData.funcMemberList
		
		/////////////
		if ( this.vFuncTab )
			this.parentTypeSortList.map(t => assert( t.offset >= 8 ) )
		
		if ( this.vtShapeList ) {
			assert( this.size >= 8 )
			;[...this.parentTypeSortList.slice(1), ...this.dataMemberList].map(t => assert( t.offset >= 8 ) )
		}
	}


	get viewParentTypeInfo() {
		const fRet = (reason, i = 0) => [
			this.parentTypeSortList[i-1] ?? null, 
			reason + '\n' + textPadStart(
				this.parentTypeSortList
					.slice(i)
					.map(n => '\t' + [n.offsetStr, n.flagsStr, '"' + n.elementType.ref.nameOrig  + '"'].filter(Boolean).join(' ') )
					.join('\n'), GAP
			) 
		]

		if ( !this.parentTypeSortList.length )
			return [null, null]

		if ( this.vFuncTab )
			return fRet('Remove multiple inheritance, has vFuncTab', 0)
		
		if ( this.isVbIvbClass )
			return fRet('Remove multiple inheritance, has vb/ivb class', 0)
		
		if ( this.parentTypeSortList.length === 1 )
			return [ this.parentTypeSortList[0], null ]

		return fRet('Remove multiple inheritance', 1)
	}
	get viewParentType() {
		return this.viewParentTypeInfo[0]
	}

	get isEmptyStruct() {
		if ( this.size !== 1 )
			return false

		if ( this.hasDataMember )
			return false
		
		if ( this.viewParentType )
			return this.viewParentType.isEmptyStruct
		
		if ( this.vFuncTab )
			return false
		
		return true
	}
	get sizeForInheritance() {
		if ( this.isEmptyStruct )
			return 0
		
		return this.size
	}

}

class TypeStruct extends extendsEx(Base_, ID_, UdtID_, Name_, Size_, IsEmptyObject_, TypeStructInfoImmutable_, DependOnMe, ParentNode_, ChildNodes_, AutoGenForFwd_, WithMiss_, Flags_) {

	#viewParentTypeSortList = null
	get viewParentTypeSortList() { 
		if ( !this.parentTypeSortList.length )
			return []
		
		return [...assert(this.#viewParentTypeSortList)] 
	}
	setViewParentTypeSortList(list) {
		this.#viewParentTypeSortList = [...list]
	}

	#viewVirtualMethodList = []
	get viewVirtualMethodList() { return [...this.#viewVirtualMethodList] }
	setViewVirtualMethodList(list) {
		this.#viewVirtualMethodList = list
	}
	
	#virtualOverTabName = null
	get virtualOverTabName() { return this.#virtualOverTabName }
	setVirtualOverTabName(name) {
		this.#virtualOverTabName = name
	}

	constructor(initData) {
		super(initData)		
	}
	
	get ids() {
		return aUnq( this.id, this.childNodes.map(n => n.ids) )
	}
	
	get depsAll() {
		return aSub(
			aUnq(
				this.parentTypeList      .map(m => m.depsAll),
				this.dataMemberList      .map(m => m.depsAll),
				this.staticDataMemberList.map(m => m.depsAll),
				this.funcMemberList      .map(m => m.depsAll),
				
				this.childNodes          .map(m => m.depsAll),
			),
			this.ids
		)
	}
	get depsDirect() {
		return aSub(
			aUnq(
				this.parentTypeList  .map(m => m.depsDirect),
				this.dataMemberList  .map(m => m.depsDirect),
				
				this.childNodes      .map(m => m.depsDirect),
			),
			this.ids
		)
	}
	
	get funcMemberNameOrigList() {
		return this.funcMemberList.map(m => m.nameOrig)
	}
	
	funcMemberProcess_ProcInfo(procMap) {
		const group = aGroup(this.funcMemberList, f => f.nameOrig)
		
		Object.entries(group).map(([funNameOrig, fList]) => {
			const fFullName = (this.nameOrig + '::' + funNameOrig).replace(/\s*/g, '')
			
			if ( !aIsUnq( fList.map(p => asLFIDValid(p.elementType.id)) ) ) {
				return
			}
			
			assert( aIsUnq( fList.map(p => asLFIDValid(p.elementType.id)) ) )
			
			let procCands = procMap[ fFullName ]
			if ( !procCands )
				return
			
			procCands = procCands.filter(p => p.functionTypeID)

			assert( aIsUnq( procCands.map(p => asLFIDValid(p.functionTypeID)) ) )
			
			fList.map(f => {
				const procInfo = procCands.find(p => p.functionTypeID === f.elementType.id)
				if ( procInfo ) {
					f.setProcInfo(procInfo)
				}
			})
		})
	}
	funcMemberProcess_ProcMiniInfo(procMap) {
		const group = aGroup(this.funcMemberList, f => f.nameOrig)
		
		Object.entries(group).map(([funNameOrig, fList]) => {
			const fFullName = (this.nameOrig + '::' + funNameOrig).replace(/\s*/g, '')
			
			if ( !aIsUnq( fList.map(p => asLFIDValid(p.elementType.id)) ) )
				return
			
			let procCands = procMap[ fFullName ]
			if ( !procCands )
				return
			
			procCands = [...procCands]

			/// т.к. нету айди на тип функции, то приблизительно ищем похожую функцию
			fList.map(f => {
				const procCandsLocal = procCands
					.filter(p => p.funFlags.static === f.flags.static)
					.filter(p => p.argList.length === f.elementType.argTypeList.length)
					.filter(p => p.thisConst === f.elementType.thisIsConst)
				
				if ( !procCandsLocal.length )
					return
				
				if ( procCandsLocal.length >= 1 ) {
					const normalizeArg = arg => {
						if ( Array.isArray(arg) ) {
							arg = arg
								.flat(1e9)
								.filter(t => !['const'].includes(t))
								.join(' ')
						}
						
						return arg
							.replace(/\bconst\b/g, '')
							.replace(/\s*/g, '')
					}
					
					const argsCode = f
						.elementType
						.argTypeList
						.map(a => a ? a.createCode({ typeID_nameForwardOrig: true, }, new WalkStack()) : '...')
						.map(normalizeArg)
					
					const procArgsCode = procCandsLocal
						.map(pr => [pr, pr
							.argList
							.map(normalizeArg)] )

					const procArgsCodeLocal = procArgsCode
						.filter(a => a[1]
							.every((c, i) => argsCode[i] === c) )
					
					assert( procArgsCodeLocal.length <= 1 )
					
					if ( !procArgsCodeLocal.length ) {
						// console.log( this.nameOrig + '::' + f.nameOrig, argsCode, procArgsCode.map(a => a[1]) )
					}

					if ( procArgsCodeLocal.length === 1 )
						f.setProcMiniInfo( procArgsCodeLocal[0][0] )
				}
			})
		})
	}
	
	staticDataMemberProcess_DataInfo(dataMap, removeInMap = true) {
		this.staticDataMemberList.map(m => {
			const fFullName = (this.nameOrig + '::' + m.nameOrig).replace(/\s*/g, '')
			
			const dataList = dataMap[ fFullName ]
			if ( !dataList )
				return
			
			if ( removeInMap )
				delete dataMap[ fFullName ]

			if ( dataList.length !== 1 )
				return

			const data = dataList[0]
			if ( !data.elementType.compare( m.elementType ) )
				return
			
			m.setAddress( data.addr )
		})
	}
	
	walk(fn, stack = new WalkStack()) {
		fn(this, stack.add(this))

		this.parentTypeList      .map(m => m.walk(fn, stack.add(this)))
		this.dataMemberList      .map(m => m.walk(fn, stack.add(this)))
		this.staticDataMemberList.map(m => m.walk(fn, stack.add(this)))
		this.funcMemberList      .map(m => m.walk(fn, stack.add(this)))
		this.nestTypeList        .map(m => m.walk(fn, stack.add(this)))
	}



	

	createCode(options = {}, stack = new WalkStack()) {
		let gapBegin       = 0
		let gapEnd         = 0
		let offset         = 0
		let specParentList = []
		
		if ( this.vFuncTab ) {
			offset += 8
			specParentList.push('$VFUNCTAB')
		}

		if ( this.viewParentTypeInfo[1] ) {
			stack.logger.group('struct_remove_multiple_inheritance').log(
				lf_NodeInfoToStr(this.lfNode) + '\n\t' + this.viewParentTypeInfo[1]
			)
		}

		if ( this.viewParentType ) {
			assert( offset === this.viewParentType.offset )
			offset += this.viewParentType.elementType.ref.sizeForInheritance
			specParentList.push( this.viewParentType.elementType.name )	/// [NAME]				
		}
		
		if ( this.dataMemberViewList ) {
			assert( offset <= this.dataMemberViewList.offset )
			assert( this.dataMemberViewList.offset + this.dataMemberViewList.size <= this.size )
			
			gapBegin = this.dataMemberViewList.offset - offset
			gapEnd   = this.size - (this.dataMemberViewList.offset + this.dataMemberViewList.size)
		} else {
			assert( offset <= this.sizeForInheritance )
			gapEnd = this.sizeForInheritance - offset
		}

		const parentCode = specParentList.map(c => 'public ' + c).join(', ')

		const codeLines = []
		////////////////////////////////////////
		codeLines.push( '/// ' + this.typePrefix + ' ' + this.nameOrig )
		codeLines.push( `/// ${ this.sizeStr } ${ this.flagsStr }` )
		if ( this.autoGenForFwd )
			codeLines.push( `/// Auto gen empty object for forward` )
			
		
		const dumpTypeInfo = (p, rm) => {
			codeLines.push(
				`///    ${ rm ? '[Removed] ' : '          ' }${ p.offsetStr } ${ p.elementType.ref.sizeStr } ${ p.flagsStr } ${ p.elementType.ref.typePrefix } ${ p.elementType.ref.nameOrig }` 
			)
		}
		
		if ( this.vFuncTab || this.viewParentType ) {
			codeLines.push('/// Parents:')
			if ( this.vFuncTab )
				codeLines.push(`///    Offset: 0 Size: 8 $VFUNCTAB`)
			if ( this.viewParentType )
				dumpTypeInfo( this.viewParentType, false )
		}

		if ( this.parentTypeList.length ) {
			codeLines.push( '/// Parents orig:' )
			this.parentTypeList.map(t => dumpTypeInfo(t, t !== this.viewParentType))
		}
		const commentReason = this.viewParentTypeInfo[1]
		if ( commentReason )
			codeLines.push(commentReason.split('\n').map(c => '/// ' + c).join('\n'))
		
		if ( this.isMiss ) {
			codeLines.push( `/// Remove type (${ this.isMissInfo })` )
			return buildLines( codeLines )
		}
		
		////////////////////////////////////////
		
		codeLines.push( buildOneLine(this.typePrefix, this.nameLocal, parentCode && (' : ' + parentCode), '{') )	/// [NAME]
		codeLines.push( ( this._ === 'TypeClass' ) && ( GAP + 'public:' ) )
		
		if ( this.childNodes.length ) {
			const childNodesSort = []
			
			let childNodes = this.childNodes
			repeatWhile(() => {
				const eids = c => c.ids
				childNodes = childNodes.filter(c => {
					if ( aIsUnq( aSub( c.depsDirect, childNodesSort.map(eids) ), aUnq(childNodes.map(eids)) ) ) {
						childNodesSort.push(c)
						return false
					}
					return true
				})
				return childNodes.length
			})
			assert( childNodes.length === 0 )
			
			childNodesSort.map(n => {
				codeLines.push(
					textPadStart( n.createCode(options, stack.add(this)), GAP )
				)
			})
		}
		
		const cdmvl = []
		if ( gapBegin                ) cdmvl.push( `uint8_t ${ nameRandomMini('gapb') }[${ gapBegin }];` )
		if ( this.dataMemberViewList ) cdmvl.push( this.dataMemberViewList.createCode(options, stack.add(this)) )
		if ( gapEnd                  ) cdmvl.push( `uint8_t ${ nameRandomMini('gape') }[${ gapEnd }];` )
		codeLines.push( textPadStart( buildTable(buildLines(cdmvl)), GAP ) )

		if ( this.virtualOverTabName ) {
			const vmlCodeLines = []
			vmlCodeLines.push(' ')
			vmlCodeLines.push('/// Virtual table')
			
			vmlCodeLines.push(`${this.virtualOverTabName}* vtb() {`)
			vmlCodeLines.push(GAP+`return ${ cOptBld.castType(this.virtualOverTabName + '*', cOptBld.castType('uint8_t*', 'this')) };`)
			vmlCodeLines.push(`};`)

			
			vmlCodeLines.push(`const ${this.virtualOverTabName}* vtb() const {`)
			vmlCodeLines.push(GAP+`return ${ cOptBld.castType('const '+this.virtualOverTabName + '*', cOptBld.castType('const uint8_t*', 'this')) };`)
			vmlCodeLines.push(`};`)
				
			codeLines.push( textPadStart( buildLines(vmlCodeLines), GAP ) )
		}

		const csdml = this
			.staticDataMemberList
			.map(m => m.createCode(options, stack.add(this)) )
		if ( csdml.length ) {
			codeLines.push(` `)
			codeLines.push(GAP + `/// Static members`)
			codeLines.push( textPadStart( buildTable( buildLines(csdml) ), GAP ) )
		}
		
		const cfml = this
			.methodList
			.map(m => m.createCode(options, stack.add(this)) )
		if ( cfml.length ) {
			codeLines.push(` `)
			codeLines.push(GAP + `/// Function members`)
			codeLines.push( textPadStart( buildTable( buildLines(cfml) ), GAP ) )
		}
		
		const csfml = this
			.staticMethodList
			.map(m => m.createCode(options, stack.add(this), true) )
		if ( csfml.length ) {
			codeLines.push(` `)
			codeLines.push(GAP + `/// Static function members`)
			codeLines.push( textPadStart( buildTable( buildLines(csfml) ), GAP ) )
		}

		codeLines.push( '};' )
		
		return buildLines(codeLines)
	}
 
 
 
	#derivationList = []
	get derivationList(  ) { return [...this.#derivationList] }
	derivationClear   (  ) { this.#derivationList = [] }
	derivationAdd     (id) { this.#derivationList.push(id) }

	#dataMemberViewList = null
	get dataMemberViewList() { return this.#dataMemberViewList }
	setDataMemberViewList(data) {
		this.#dataMemberViewList = data
	}


	get typePrefix() {
		return assert( mObj({
			TypeStruct: 'struct',
			TypeClass : 'class',
			TypeUnion : 'union',
		})[ this._ ] )
	}
}
class TypeClass extends TypeStruct {}
class TypeUnion extends TypeStruct {
	constructor(initData) {
		super(initData)
		
		assert( !this.parentTypeList.length )
		assert( !this.vtShapeList )
	}
}

class TypeVTabOverStruct extends extendsEx(Base_, Name_, ElementType_) {
	#virtMethodList = []
	get virtMethodList() { return [...this.#virtMethodList] }

	constructor(initData) {
		super(initData)
		
		this.#virtMethodList = initData.virtMethodList
	}
	
	createCode(options, stack = new WalkStack()) {
		const codeLines = []
		codeLines.push( this.elementType.ref.typePrefix + ' ' + this.name + ' : public ' + this.elementType.ref.name + ' {' )
		codeLines.push( GAP + 'public:' )
		
		codeLines.push( textPadStart(
			buildTable(
				this.virtMethodList
					.map(v => v.createCodeImplementationVirt(options, stack.add(this), '') )
					.join('\n') ),
			GAP
		) )
		
		codeLines.push('};')
		return buildLines(codeLines)
	}
}

class TypeProc extends extendsEx(Base_, ID_, Name_, ElementType_, WithProcInfo_, DependOnMe, ParentNode_, WithMiss_) {
	constructor(initData) {
		super(initData)
		
		this.elementType.assert_( TypeProcedure )
	}
	
	createCode(options = {}, stack = new WalkStack()) {
		const codeLines = []
		
		codeLines.push( buildOneLine(
			'///', this.nameOrig, this.address ? this.address.text : ''
		) )
		
		if ( this.isMiss ) {
			codeLines.push( `/// Remove procedure "${this.nameOrig}" (${ this.isMissInfo })` )
			return buildLines( codeLines )
		}
		
		codeLines.push( this.elementType.createCode_ProcedureHeader(options, stack.add(this), {
			name: this.nameLocal, 
			argNamePossibleList: this.argNamePossibleList,
		}) )
		
		return buildLines(codeLines)
	}
	createCodeImplementation(options, stack = new WalkStack(), namePrefix) {
		const name = [namePrefix, this.name]
			.flat(1e9)
			.filter(Boolean)
			.join('::')
		
		const codeLines = []
		codeLines.push( this.elementType.createCode_ProcedureSource(options, stack.add(this), {
			name, 
			argNamePossibleList: this.argNamePossibleList,
			absAddress: cOptBld.castAddr(this.address)
		}) )
		
		return buildLines(codeLines)
	}
}

class TypeVar extends extendsEx(Base_, ID_, Name_, ElementType_, WithAddress_, DependOnMe, ParentNode_) {
	createCode(options, stack = new WalkStack()) {
		const comment = '/// ' + [this.address ? this.address.text : '', '"' + this.nameOrig + '"']
			.filter(Boolean)
			.join(' ')

		const postComment = []
		if ( this.elementType.check_(TypePointer) ) {
			if ( this.elementType.flags.lValueReference ) {
				options = {...options, typePointer_FirstIgnoreLValueReference: true, }
				postComment.push('[replace & to * in pointer type]')
				stack.logger.group('global_var_replace_pointer_type').log( 'Replace & to * in pointer type\n' +
					textPadStart( stack.add(this).toString(), GAP ) )
			}
			if ( this.elementType.flags.const_ ) {
				options = {...options, typePointer_FirstIgnoreConst: true, }
				postComment.push('[cancel const in pointer type]')
				stack.logger.group('global_var_cancel_pointer_type').log( 'Cancel const in pointer type\n' +
					textPadStart( stack.add(this).toString(), GAP ) )
			}
		}
		
		const tn = nameRandomMini()
		
		const codeLines = []
		codeLines.push(
			buildLines(comment, postComment.length ? '/// ' + postComment.join(' ') : '')
		)
		
		const castType =  this.elementType.createCode(options, stack.add(this))
		/// codeLines.push( `using ${tn} = ${ this.elementType.createCode(options, stack.add(this)) };` )
		codeLines.push( `${castType}& ${ this.nameLocal } = *` + 
			cOptBld.castType( `${castType}*`, cOptBld.castAddr(this.address) ) + ';' )
		
		return buildLines( codeLines )
	}

	get depsAll   () { return this.elementType.depsAll }
	get depsDirect() { return [] }
}

class TypeUsing extends extendsEx(Base_, ID_, Name_, ElementType_) {
	createCode(options, stack) {
		return `using ${ this.nameLocal } = ${ this.elementType.createCode(options, stack.add(this)) };`	/// [NAME]
	}
}

class TypeNamespace extends extendsEx(Base_, ID_, Name_, ParentNode_, ChildNodes_, DependOnMe) {
	get depsAll   () { return aUnq( this.childNodes.map(n => n.depsAll) ) }
	get depsDirect() { return aUnq( this.childNodes.map(n => n.depsDirect) ) }
	
	createCode(options, stack = new WalkStack()) {
		const codeLines = []
		
		codeLines.push( `namespace ${ this.nameLocal } {` )
		
		this.childNodes.map(n => {
			codeLines.push(
				textPadStart( n.createCode(options, stack.add(this)), GAP )
			)
		})
		
		codeLines.push( `}` )
		
		return buildLines(codeLines)
	}
}

class _Section extends extendsEx(Base_, Name_, Size_) {
	#id = 0
	#align = 0
	#characteristics = 0
	#rva = 0n
	
	get id             () { return this.#id }
	get align          () { return this.#align }
	get characteristics() { return this.#characteristics }
	get rva            () { return this.#rva }

	constructor(initData) {
		super(initData)
		
		this.#id = asUIntValid(initData.id)
		this.#align = asUIntValid(initData.align)
		this.#characteristics = initData.characteristics|0
		
		this.#rva = asBigIntUIntValid(initData.rva)
	}
}

class TypeProcedure extends extendsEx(Base_, ID_) {
	#callConvention = ''
	#returnType     = null
	#argTypeList    = []
	#argTypeListID  = 0

	get callConvention() { return assert( CCallConventionMap[ this.#callConvention ] ) }
	get returnType    () { return this.#returnType }
	get argTypeList   () { return [...this.#argTypeList] }
	get argTypeListID () { return this.#argTypeListID }
	get isVariadicArgs() { return this.argTypeList.length && !this.argTypeList.at(-1) }
	
	constructor(initData) {
		super(initData)
		
		this.#callConvention = initData.callConvention
		this.#returnType     = initData.returnType
		this.#argTypeList    = initData.argTypeList
		this.#argTypeListID  = asLFIDValid(initData.argTypeListID)

		assert( this.callConvention )
		assert( this.returnType )
		assert( this.argTypeList )
		assert( Array.isArray(this.argTypeList) )
		assert( this.argTypeListID > 0 )
		
		const numNullArgs = this.argTypeList.filter(a => !a).length
		if ( numNullArgs ) {
			assert( numNullArgs === 1 )
			assert( !this.argTypeList.at(-1) )
		}
	}

	get depsAll   () { 
		return aUnq(
			this.returnType.depsAll,
			this.argTypeList.filter(Boolean).map(a => a.depsAll),
		) 
	}
	get depsDirect() { return [] }

	getArgNameList(argNamePossibleList) {
		argNamePossibleList = argNamePossibleList ?? []
		
		let argNameList = this.argTypeList
			.map((t, i) => argNamePossibleList[i] ?? `arg${ i + 1 }`)
			.map(nameNormalizeDefineRules)
		
		while( new Set(argNameList).size !== argNameList.length ) {
			const nSet = new Set()
			argNameList = argNameList
				.map((a, i) => (a = nSet.has(a) ? `${a}$` : a, nSet.add(a), a))
		}
		
		return argNameList
	}

	createCode(options, stack, injectArg = null) {
		const cc   = this.callConvention
		const args = [...(injectArg ? [injectArg] : []), ...this.argTypeList]
		args.slice(0, -1).map(assert)

		return buildOneLine(
			'$F<',
			this.returnType.createCode(options, stack.add(this)),
			cc,
			'('+
				args
					.map(arg => arg ? arg.createCode(options, stack.add(this)) : '...')
					.join(', ')
				+
			')',
			'>',
		)
	}
	createCodeWithOutTplDeclare(options, stack, injectArg = null) {
		const cc   = this.callConvention
		const args = [...(injectArg ? [injectArg] : []), ...this.argTypeList]
		args.slice(0, -1).map(assert)

		return buildOneLine(
			this.returnType.createCode(options, stack.add(this)),
			`(${cc}*)(` +
				args
					.map(arg => arg ? arg.createCode(options, stack.add(this)) : '...')
					.join(', ')
				+
			')',
		)
	}
	
	createCodeArgsForCall(injectArg) {
		return [...(injectArg ? [injectArg] : []), ...this.argTypeList]
			.map((a, i) => `arg${ i + 1 }`)
			.join(', ')
	}
	
	createCodeWithOutTplDeclareEx(options, stack, sOptions, injectArg = null) {
		assert( !this.isVariadicArgs )

		const cc   = this.callConvention
		const args = [...(injectArg ? [injectArg] : []), ...this.argTypeList]
		
		const argsEx = args.map((a, i) => ({ 
			type: a.createCode(options, stack.add(this)),
			name: `arg${ i + 1 }`,
		}))
		
		const retTypeNative = this.returnType.createCode(options, stack.add(this))
		
		const retTypeCode = sOptions.returnType ?? retTypeNative
		
		if ( sOptions.backArgs )
			argsEx.push( ...sOptions.backArgs.map(t => {
				t = { ...t }
				if ( t.type === '{returnType}' )
					t.type = retTypeNative

				return t
			}) )
		
		const argsCode = '(' + 
			argsEx
				.map(a => a.type + ( sOptions.printName ? ' ' + a.name : '' ) )
				.join(', ') +
			')'
		
		if ( sOptions.onlyArgs )
			return argsCode
		
		return buildOneLine( retTypeCode, `(${cc}*)${ argsCode }` )
	}
	
	createCodeEx(options, stack, sOptions, injectArg = null) {
		assert( !this.isVariadicArgs )

		const cc   = this.callConvention
		const args = [...(injectArg ? [injectArg] : []), ...this.argTypeList]
		
		const argsEx = args.map((a, i) => ({ 
			type: a.createCode(options, stack.add(this)),
			name: `arg${ i + 1 }`,
		}))
		
		const retTypeNative = this.returnType.createCode(options, stack.add(this))
		
		const retTypeCode = sOptions.returnType ?? retTypeNative
		
		if ( sOptions.backArgs )
			argsEx.push( ...sOptions.backArgs.map(t => {
				t = { ...t }
				if ( t.type === '{returnType}' )
					t.type = retTypeNative

				return t
			}) )
		
		const argsCode = '(' + 
			argsEx
				.map(a => a.type + ( sOptions.printName ? ' ' + a.name : '' ) )
				.join(', ') +
			')'
		
		if ( sOptions.onlyArgs )
			return argsCode
		
		return buildOneLine(
			'$F<',
			retTypeCode,
			cc,
			argsCode,
			'>',
		)
		
	}

	createCode_ProcedureHeader(options, stack, sOptions) {
		const argNameList = this.getArgNameList(sOptions.argNamePossibleList)
		
		return buildOneLine(
			this.returnType.createCode(options, stack.add(this)),
			sOptions.name + '(' + this
				.argTypeList
				.map((arg, i) => arg ? 
					buildOneLine( arg.createCode(options, stack.add(this)), argNameList[i] ) : '...' )
				.join(', ') +
			');'
		)
	}
	createCode_ProcedureSource(options, stack, sOptions) {
		const { name, argNamePossibleList, absAddress } = sOptions
		const argNameList = this.getArgNameList(argNamePossibleList)
		
		const argsCode = this.argTypeList
			.map((arg, i) => arg ? buildOneLine( arg.createCode(options, stack.add(this)), argNameList[i] ) : '...' )
			.join(', ')

		let castType = this.globalTypeCodeName ?? ( this.createCode(options, stack) + '*' )
		if ( this.globalTypeCodeName )
			castType = `__Local__::${ this.globalTypeCodeName }` /// [LOCAL]
		
		return buildLines(
			buildOneLine(
				this.returnType.createCode(options, stack.add(this)) + '{TD_0}',
				name + '(' + argsCode + ')' + (this.thisIsConst ? ' const' : ''),
				'{',
			),
			GAP + `return ( ${ cOptBld.castType(castType, absAddress) } )(${ argNameList.join(', ') });`,
			'}'
		)
	}

	walk(fn, stack = new WalkStack()) {
		fn(this, stack.add(this))
		this.returnType.walk(fn, stack.add(this))
		this.argTypeList.filter(Boolean).map(a => a.walk(fn, stack.add(this)))
	}

	get signature() {
		return this.createCode({}, new WalkStack(), null)
	}


	#globalTypeCodeName = null
	#globalTypeCode     = null
	get globalTypeCodeName() { return this.#globalTypeCodeName }
	get globalTypeCode    () { return this.#globalTypeCode }
	
	setGlobalTypeCode(name, code) {
		this.#globalTypeCodeName = name
		this.#globalTypeCode = code
	}
}
class TypeMFunction extends TypeProcedure {
	#classType  = null
	#thisType   = null
	#thisAdjust = 0
	
	#thisIsConst = false

	get classType  () { return this.#classType }
	get thisType   () { return this.#thisType }
	get thisAdjust () { return this.#thisAdjust }
	get thisIsConst() { return this.#thisIsConst }

	constructor(initData) {
		super(initData)
		
		this.#classType  = initData.classType
		this.#thisType   = initData.thisType
		this.#thisAdjust = asUIntValid(initData.thisAdjust)
		
		assert( this.#classType )
		
		this.classType.assert_(TypeID)
		if ( this.thisType ) {
			this.thisType.assert_( TypePointer )
			
			let m = null
			let t = this.thisType.elementType
			if ( t.check_(TypeModifier) ) {
				m = t
				t = t.elementType
			}
			
			t.assert_(TypeID)
			
			assert( this.classType.id === t.id )
			
			if ( m ) {
				assert( !m.flags.unaligned )
				assert( !m.flags.volatile  )
				assert(  m.flags.const_    )
				
				this.#thisIsConst = m.flags.const_
			}
		}
	}

	get depsAll   () { 
		return aUnq( super.depsAll, this.thisType ? this.thisType.depsAll : [] )
	}

	createCode(options, stack) {
		return super.createCode(options, stack, this.thisType)
	}
	createCodeWithOutTplDeclare(options, stack) {
		return super.createCodeWithOutTplDeclare(options, stack, this.thisType)
	}
	createCodeWithOutTplDeclareEx(options, stack, sOptions, injectArg = null) {
		return super.createCodeWithOutTplDeclareEx(options, stack, sOptions, this.thisType)
	}
	
	createCodeEx(options, stack, sOptions) {
		return super.createCodeEx(options, stack, sOptions, this.thisType)
	}
	
	createCodeArgsForCall() {
		return super.createCodeArgsForCall(this.thisType)
	}
	

	createCode_MethodHeader(options, stack, name, argNamePossibleList) {
		const argNameList = this.getArgNameList(argNamePossibleList)

		const argsCode = this.argTypeList
			.map((arg, i) => arg ? buildOneLine( arg.createCode(options, stack.add(this)), argNameList[i] ) : '...' )
			.join(', ')

		return buildOneLine(
			this.thisType ? '' : 'static',
			
			this.returnType.createCode(options, stack.add(this)) + '{TD_0}',
			
			name + '(' + argsCode + ')' + (this.thisIsConst ? ' const' : '') + ';'
		)
	}
	createCode_MethodSource(options, stack, sOptions) {
		const { name, argNamePossibleList, absAddress } = sOptions
		const argNameList = this.getArgNameList(argNamePossibleList)

		const argsCode = this.argTypeList
			.map((arg, i) => arg ? buildOneLine( arg.createCode(options, stack.add(this)), argNameList[i] ) : '...' )
			.join(', ')

		let castType = this.globalTypeCodeName ?? ( this.createCode(options, stack) + '*' )
		if ( this.globalTypeCodeName )
			castType = `__Local__::${ this.globalTypeCodeName }`	/// [LOCAL]

		return buildLines(
			buildOneLine(
				this.returnType.createCode(options, stack.add(this)) + '{TD_0}',
				name + '(' + argsCode + ')' + (this.thisIsConst ? ' const' : ''),
				'{',
			),			
			GAP + `return ( ${ cOptBld.castType(`${ castType }`, absAddress) } )(${ [...( this.thisType ? ['this'] : [] ), ...argNameList].join(', ') });`,
			'}'
		)
	}

	walk(fn, stack = new WalkStack()) {
		super.walk(fn, stack)
		
		this.classType.walk(fn, stack.add(this))
		if ( this.thisType )
			this.thisType.walk(fn, stack.add(this))
	}

	get signatureWithoutThis() {
		return super.createCode({}, new WalkStack(), null) + (this.thisIsConst ? ' const' : '')
	}
}


const dbgMap = {}
const dbgAdd = key => (dbgMap[key] = (dbgMap[key]|0) + 1)
const dbgPrint = () => console.log( dbgMap )

class Builder {
	typeList = []
	procList = []
	typeMap  = Object.create(null)
	typeEmptySet = new Set()
	lfNoImplNodeSet = new Set()

	skip_VBClassSet = new Set()
	skip_IVBClassSet = new Set()
	skip_FwdParentClassSet = new Set()
	replace_InvalidFieldNameList = []
	
	

	astTypeList = []
	astTypeMap  = Object.create(null)
	addAstType(node) {
		const id = asLFIDValid( node.id )
		
		assert( !this.astTypeMap[ id ] )
		
		this.astTypeList.push(node)
		this.astTypeMap[ id ] = node
	}
	getNodeByID_opt(id) {
		return this.astTypeMap[ asLFIDValid( id ) ] ?? null
	}
	getNodeByID(id) {
		return assert( this.getNodeByID_opt(id) )
	}
	hasNode(id) {
		id = asLFIDValid( node.id )
		return this.astTypeMap[ id ]
	}
	
	lf_GetNodeListFilter(...args) {
		return this.typeList.filter(t => lf_CheckLfType(t, ...args))
	}
	lf_GetNodeByID(id) {
		id = asLFIDValid(id)
		const node = this.typeMap[ id ]
		assert( node )
		return node
	}
	lf_GetNodeImp_opt(lfNode) {
		lf_AssertLfType(lfNode, 'LF_STRUCTURE', 'LF_CLASS', 'LF_UNION', 'LF_ENUM')
		
		if ( this.lf_IsImpNode(lfNode) )
			return lfNode

		if ( !lfNode.udtID )
			return null
		
		const lfNodeNext = this.lf_GetNodeByID(lfNode.udtID)
				
		assert( lfNode.lf_type   === lfNodeNext.lf_type )
		assert( lfNode.name      === lfNodeNext.name    )
		assert( lfNode    .udtID === lfNodeNext.id      )
		assert( lfNodeNext.udtID === lfNodeNext.id      )
		
		return lfNodeNext
	}
	lf_GetNodeImpByID_opt(id) {
		return this.lf_GetNodeImp_opt( this.lf_GetNodeByID(id) )
	}
	lf_IsImpNode(lfNode) {
		if ( this.lf_IsFwdNode(lfNode) )
			return false
		/**
		if ( !lfNode.udtID )
			return false
		
		if ( lfNode.id !== lfNode.udtID )
			return false
		*/
		return true
	}
	lf_IsFwdNode(lfNode) {
		lf_AssertLfType(lfNode, 'LF_STRUCTURE', 'LF_CLASS', 'LF_UNION', 'LF_ENUM')
		
		assert( !(  lfNode.fieldListTypeID &&  lfNode.flags.forwardRef ) )
		assert( !( !lfNode.fieldListTypeID && !lfNode.flags.forwardRef ) )
				
		const fieldListTypeID = asUIntValid( lfNode.fieldListTypeID )
		const size = asUIntValid( lfNode.size )

		if ( lfNode.flags.forwardRef ) {
			assert( !fieldListTypeID )
			if ( lfNode.lf_type !== 'LF_ENUM' )
				assert( size === 0 )

			return true
		}

		assert( fieldListTypeID )
		assert( size > 0 )
		return false
	}
	
	
	validProcType() {
		this.procList.map(p => {
			if ( p.functionTypeID ) {
				const fType = this.typeMap[ p.functionTypeID ]
				assert( fType )
				lf_AssertLfType( fType, 'LF_PROCEDURE', 'LF_MFUNCTION' )
			}
		})
	}

	_buildType_CreateEmpty_(lfNode) {
		const node = this.getNodeByID_opt(lfNode.id)
		if ( node )
			return node
		
		const initData = { 
			...lfNode, 
			lfNode, 
				
			vtShapeList: null, 
			vFuncTab: false,
			parentTypeList: [], 
			dataMemberList: [], 
			staticDataMemberList: [], 
			funcMemberList: [], 
			nestTypeList: [], 
				
			isClear      : false  ,
			clearReasonList: [],
				
			isVbIvbClass: false,
				
			attrFlags: new Set(),
			
			memberList: [],
				
			elementType: new TypeScalar({ name: 'int32_t', size: 4, }),
			
			autoGenForFwd: true,
		}
		
		initData.size = 1
		if ( lfNode.lf_type === 'LF_ENUM' )
			initData.size = 4

		const class_ = assert( ({
			LF_STRUCTURE: TypeStruct,
			LF_CLASS    : TypeClass,
			LF_UNION    : TypeUnion,
			LF_ENUM     : TypeEnum,
		})[lfNode.lf_type] )
		
		const type = new class_(initData)
		this.addAstType( type )

		this.logger.group('struct_create_empty_for_forward').log( lf_NodeInfoToStr(lfNode) )

		return type
	}
	_buildType_Procedure_(lfNode) {
		const callConvention = lfNode.callConvention
		const returnType     = this._buildType( lfNode.returnType )
		const lfArgTypeList  = this.lf_GetNodeByID( lfNode.argTypeListID )

		assert( lfNode.numParams === lfArgTypeList.argTypeList.length )
		assert( lfArgTypeList.argumentCount === lfArgTypeList.argTypeList.length )
			
		let isVariadicArgs = false
		const lfArgTypeListArr = [...lfArgTypeList.argTypeList]
		if ( lfArgTypeListArr.length ) {
			if ( lfArgTypeListArr[ lfArgTypeListArr.length - 1 ] === null ) {
			//	lfArgTypeListArr.pop()
				isVariadicArgs = true
			}
		}
		const argTypeList = lfArgTypeListArr.map(argType => argType ? this._buildType(argType) : argType)
		
		return { ...lfNode, lfNode, callConvention, returnType, argTypeList, isVariadicArgs, }
	}
	_buildTypeID(id, options = {}) {
		const lfNode = this.lf_GetNodeByID(id)

		if ( lf_CheckLfType(lfNode, 'LF_STRUCTURE', 'LF_CLASS', 'LF_UNION', 'LF_ENUM') ) {
			const lfNodeImp = this.lf_GetNodeImp_opt(lfNode)
			if ( lfNodeImp )
				return new TypeID({ ...lfNodeImp, lfNode: lfNodeImp, })

			const node = this._buildType_CreateEmpty_(lfNode)

			return new TypeID({ ...lfNode, lfNode, size: node.size, })
		}

		if ( lfNode.lf_type === 'LF_POINTER' ) {
			const elementType = this._buildType( lfNode.elementType )
			return new TypePointer({ ...lfNode, lfNode, elementType, })
		}
		
		if ( lfNode.lf_type === 'LF_MODIFIER' ) {
			const elementType = this._buildType( lfNode.elementType )
			const size = elementType._ === 'TypeVoid' ? 0 : elementType.size
			return new TypeModifier({ ...lfNode, lfNode, elementType, size, })
		}
		
		if ( lfNode.lf_type === 'LF_ARRAY' ) {
			const elementType = this._buildType( lfNode.elementType )
			assert( elementType.size )
			const length = asUIntValid( lfNode.size / elementType.size )
			return new TypeArray({ ...lfNode, lfNode, elementType, length, })
		}
		
		if ( lfNode.lf_type === 'LF_PROCEDURE' ) {
			return new TypeProcedure({ ...this._buildType_Procedure_(lfNode) })
		}
		
		if ( lfNode.lf_type === 'LF_MFUNCTION' ) {
			const tProc = { ...this._buildType_Procedure_(lfNode) }
			const classType  = this._buildType( lfNode.classType )
			const thisType   = lfNode.thisType ? this._buildType( lfNode.thisType  ) : null
			const thisAdjust = lfNode.thisAdjust

			if ( !options.hasMethod ) {
				assert( thisAdjust === 0 )
				
				if ( thisType ) {
					let t = thisType
					t.assert_(TypePointer)
					t = t.elementType
					if ( t.check_(TypeModifier) )
						t = t.elementType
					t.assert_(TypeID)
					
					assert( t.compare(classType) )
				}
				
				tProc.argTypeList.unshift(thisType)
				
				this.logger.group('mfunction_to_procedure').log( lf_NodeInfoToStr(lfNode) )
				
				return new TypeProcedure({ ...tProc })
			}
			

			return new TypeMFunction({ ...tProc, classType, thisType, thisAdjust, })
		}
		
		if ( lfNode.lf_type === 'LF_BITFIELD' ) {
			const elementType = this._buildType(lfNode.elementType)
			elementType.assert_( TypeScalar )
			
			return new TypeBitfield({ ...lfNode, lfNode, elementType, })
		}
		
		assert(false)
	}
	_buildType(t) {
		if ( t.typeID )
			return this._buildTypeID( t.typeID )

		const elementType = ( t.typeName === 'void' ) ?
			new TypeVoid() : new TypeScalar({ name: t.typeName, size: t.size })

		if ( t.typePtr )
			return new TypePointerTmp({ elementType, size: 8, })
		
		return elementType
	}
	
	/// api
	buildType(t) {
		return this._buildType(t)
	}
	addType(node) {
		this.addAstType(node)
	}
	getTypeList() {
		return [...this.astTypeList]
	}

	lf_AddNoImplNode(id) {
		id = asLFIDValid(id)
		assert( !this.lfNoImplNodeSet.has(id) )
		this.lfNoImplNodeSet.add(id)
	}
	
	_logIncompleteType(lfNode) {
		if ( !this.lf_GetNodeImpByID_opt(lfNode.id) )
			this.logger.group('incomplete_type').log( lf_NodeInfoToStr(lfNode) )
	}
	
	buildEnumList() {
		this
			.lf_GetNodeListFilter('LF_ENUM')
			.filter(n => {
				if ( this.lf_IsImpNode(n) )
					return true

				this._logIncompleteType(n)
				return false
			})
			.map(lfNode => {
				const elementType = this
					._buildType( lfNode.elementType )
					.assert_( TypeScalar )

				const memberList = this
					.lf_GetNodeByID( lfNode.fieldListTypeID )
					.fieldList
					.map(child => new TypeEnum_Member({ ...child, lfNode: child }))

				this.addAstType( new TypeEnum({ ...lfNode, lfNode, elementType, memberList, }) )
			})
	}

	_structFieldNameFix(lfNode, field) {
		let fieldName = field.name
		if ( fieldName ) {
			if ( fieldName.length === 256 ) {
				const cdName = nameSplitNamespace(lfNode.name).pop()
				assert( cdName )
								
				const newName = [cdName, '~'+cdName].find(c => c.startsWith(fieldName))
				assert( newName )
				
				this.logger.group('struct_restored_member_names').log( lf_NodeInfoToStr(lfNode) + '\n' +
					'\tRestored long invalid member name: \n' +
					`\tOldName: "${ fieldName }"\n` +
					`\tNewName: "${ newName }"`
				)

				fieldName = newName
			}
		}
		
		return fieldName
	}
	buildStructList() {
		this.lf_GetNodeListFilter('LF_STRUCTURE', 'LF_CLASS', 'LF_UNION').map(lfNode => {
			if ( !this.lf_IsImpNode(lfNode) ) {
				this._logIncompleteType(lfNode)
				return
			}
			
			assert( asUIntValid(lfNode.size) > 0 )
			
			let   vtShapeList = null
			let   vFuncTab    = false
			const parentTypeList = []
			const dataMemberList = []
			const staticDataMemberList = []
			const funcMemberList = []
			const nestTypeList = []
			const clearReasonList = []
			let   isClear = false
			let   isForwardParent = false
			let   isVbIvbClass = false
			let   numMembersAddCorrect = 0
			const attrFlags = new Set()

			const rawFieldList = this.lf_GetNodeByID( lfNode.fieldListTypeID ).fieldList
			assert( lfNode.numMembers >= rawFieldList.length )

			let i = -1
			for(const field of rawFieldList) {
				i++
				assert( field.memberIndex === i )
					
				const fieldName = this._structFieldNameFix(lfNode, field)

				if ( field.lf_type === 'LF_BCLASS' ) {
					assert( field.elementType.typeID )
					assert( !lfNode.flags.forwardRef )
							
					const lfParentType = this.lf_GetNodeImpByID_opt(field.elementType.typeID)
					if ( !lfParentType ) {
						this.skip_FwdParentClassSet.add(lfNode.id)
						this.logger.group('struct_incomplete_parent_types').log(lf_NodeInfoToStr(lfNode))
						return
					}

					parentTypeList.push(
						new TypeStruct_DataMember({ 
							...field, 
							lfNode     : field, 
							elementType: new TypeID(lfParentType), 
							name       : `bclass_${i}` 
						})
					)
					continue
				}

				if ( field.lf_type === 'LF_MEMBER' ) {
					dataMemberList.push( 
						new TypeStruct_DataMember({ 
							...field, 
							lfNode     : field, 
							name       : fieldName,
							elementType: this._buildType( field.elementType ),
						})
					)
					continue
				}

				if ( field.lf_type === 'LF_STATICMEMBER' ) {
					staticDataMemberList.push( 
						new TypeStruct_StaticDataMember({ 
							...field, 
							lfNode     : field, 
							name       : fieldName,
							elementType: this._buildType( field.elementType ),
						})
					)
					continue
				}

				if ( field.lf_type === 'LF_ONEMETHOD' ) {
					funcMemberList.push(
						new TypeStruct_FuncMember({
							...field, 
							lfNode     : field, 
							name       : fieldName,
							elementType: this._buildTypeID( field.functionTypeID, { hasMethod: true } ),
						})
					)
					continue
				}
						
				if ( field.lf_type === 'LF_METHOD' ) {
					assert( field.methodListID )
					const lfMethodList = this.lf_GetNodeByID(field.methodListID)
					assert( field.count === lfMethodList.methodList.length )
					assert( field.count >= 2 )
					
					numMembersAddCorrect += field.count - 1
							
					lfMethodList.methodList.map(m => {
						funcMemberList.push(
							new TypeStruct_FuncMember({
								...m, 
								lfNode     : field, 
								name       : fieldName,
								memberIndex: field.memberIndex,
								elementType: this._buildTypeID( m.functionTypeID, { hasMethod: true } ),
							})
						)
					})
							
					continue
				}

				if ( field.lf_type === 'LF_NESTTYPE' ) {
					nestTypeList.push(
						new TypeStruct_Nesttype({
							...field,
							elementType: this._buildType( field.elementType ),
						})
					)
					continue
				}
						
				if ( field.lf_type === 'LF_VFUNCTAB' ) {
					assert( field.elementType.typeID )
					const lfPtr = this.lf_GetNodeByID( field.elementType.typeID )
					const falseFlags = [ 
						'const_', 'unaligned', 'volatile', 'singleInheritance', 
						'multipleInheritance', 'virtualInheritance', 'mostGeneral', 
						'lValueReference', 'pointerToMemberFunction', 'pointerToMemberData'
					]
					assert( lfPtr.lf_type === 'LF_POINTER' )
					assert( falseFlags.every(f => lfPtr.flags[ f ] === false) )
					assert( lfPtr.flags.pointer === true )

					const lfVTShape = this.lf_GetNodeByID( lfPtr.elementType.typeID )
					assert( lfVTShape.lf_type === 'LF_VTSHAPE' )
							
					assert( !vtShapeList )
					assert( !vFuncTab )
					vtShapeList = lfVTShape.vtShapeList
					vFuncTab = true
							
					assert( lfNode.vtShapeTypeID === lfPtr.elementType.typeID )			
					continue
				}
						
				if ( field.lf_type === 'LF_VBCLASS'  ) {  //// пропустить
					attrFlags.add('LF_VBCLASS')
					clearReasonList.push('LF_VBCLASS')
					isClear = true
					isVbIvbClass = true

					this.skip_VBClassSet.add( lfNode.id )
					assert( field.memberIndex === 0 ); 
					continue 
				}
						
				if ( field.lf_type === 'LF_IVBCLASS' ) { //// пропустить
					attrFlags.add('LF_IVBCLASS')
					clearReasonList.push('LF_IVBCLASS')
					isClear = true
					isVbIvbClass = true

					this.skip_IVBClassSet.add( lfNode.id )
					continue 
				}
						
				assert( false )
			}
			
			
			assert( !lfNode.derivationListTypeID )
			
			if ( lfNode.vtShapeTypeID ) {
				if ( !vtShapeList ) {
					vtShapeList = this.lf_GetNodeByID( lfNode.vtShapeTypeID ).vtShapeList
				}
			}

			if ( lfNode.lf_type === 'LF_UNION' ) {
				assert( !lfNode.vtShapeTypeID  )
				assert( !parentTypeList.length )
				assert( !vtShapeList )
				assert( !isClear )
			}
			
			assert( rawFieldList.length + numMembersAddCorrect === lfNode.numMembers )

			funcMemberList.map(f => {
				
				f.elementType.assert_( TypeMFunction )
				if ( !f.elementType.thisType ) assert( f.flags.static )
				if ( f.flags.static ) assert( !f.elementType.thisType )
				
			})
			
			/// #######################
			const initData = { 
				...lfNode, 
				lfNode, 
				
				vtShapeList, 
				vFuncTab,
				parentTypeList, 
				dataMemberList, 
				staticDataMemberList, 
				funcMemberList, 
				nestTypeList, 
				
				isClear        ,
				clearReasonList,
				
				isVbIvbClass,
				
				attrFlags,
			}
			switch( lfNode.lf_type ) {
				case 'LF_CLASS':
					return new TypeClass (initData)
					
				case 'LF_STRUCTURE':
					return new TypeStruct(initData)
					
				case 'LF_UNION':
					return new TypeUnion(initData)
					
				default:
					assert(false)
			}
		})
		.filter(Boolean)
		.map(n => this.addAstType(n))
	}

	buildProcList(procList) {
		procList.map(lfProcNode => {
			if ( lfProcNode.functionTypeID ) {
				const lfNode = this.typeMap[ lfProcNode.functionTypeID ]
				assert( lfNode )
				lf_AssertLfType( lfNode, 'LF_PROCEDURE', 'LF_MFUNCTION' )
				
				if ( lf_CheckLfType(lfNode, 'LF_PROCEDURE') ) {
					const elementType = this._buildTypeID(lfNode.id)

					const node = new TypeProc({
						id  : getUnqID(), 
						name: lfProcNode.name, 
						elementType, 
						lfProcNode, 
					})
					node.setProcInfo( lfProcNode )
					this.addAstType( node )
				}
			}
		})

		/// this.lf_GetNodeListFilter('LF_PROCEDURE').map(lfNode => this.addAstType( this._buildTypeID( lfNode.id ) ) )
	}
	
	dataList = []
	buildDataList(dataList) {
		this.dataList = dataList.map(lfProcNode => {
			return { ...lfProcNode, elementType: this._buildType(lfProcNode.type), }
		})
	}


	sectionMap = []
	buildSectionList(sectionList) {
		const list = sectionList.map(s => 
			new _Section({ 
				id: parseInt(s.id, 16),
				size: parseInt(s.cb, 16),
				align: parseInt(s.align, 16),
				characteristics: parseInt(s.characteristics, 16),
				rva: BigInt( '0x' + s.rva ),
				name: s.name, 
			})
		)
		
		const map = Array(Math.max(...list.map(s => s.id)) + 1).fill(null)
		list.map(s => map[ s.id ] = s)
		
		assert( !map[0] )
		map[0] = new _Section({
			id: 0,
			size: 0x1000,
			align: 0x1000,
			characteristics: 0,
			rva: 0n,
			name: '.__imageBase_autogen'
		})
		
		this.sectionMap = Object.freeze(map)
	}

	logger = null
	build(pdb) {
		this.typeList = pdb.typeList
		this.procList = pdb.procList
		this.nameGroup = pdb.nameGroup
		this.dataList = pdb.dataList
		this.typeMap  = Object.create(null)
		this.typeList.map(t => this.typeMap[ t.id ] = t)
		
		
		this.validProcType()
		
		this.buildEnumList()
		this.buildStructList()
		this.buildProcList( pdb.procList )
		this.buildDataList( pdb.dataList )
		this.buildSectionList( pdb.sectionList )
	}
	
	constructor(logger) {
		this.logger = logger
	}
}

////////////////////////////////////////
////////////////////////////////////////
////////////////////////////////////////

function AstProcessing(astBuilder, logger, outDir) {
	const lfProcList = astBuilder.procList

	const InheritNodes     = [ TypeStruct, TypeClass ]
	const InheritFullNodes = [ TypeStruct, TypeClass, TypeUnion ]
	const FullNodes        = [ TypeStruct, TypeClass, TypeUnion, TypeEnum ]

	const getNodeList = () => astBuilder.getTypeList()
	const getNodeFilterList = (...args) =>
		getNodeList().filter(n => n.check_(...args))
		
	const walkAll = fn =>
		getNodeList().map(n => n.walk(fn))
	
	let _nodeMap = Object.create(null)
	const getNodeByID_opt = id => _nodeMap[ asLFIDValid(id) ] ?? null
	const getNodeByID     = id => assert(getNodeByID_opt(id))
	const getNodeNameOrigByID = id => getNodeByID(id).nameOrig

	const buildNodeMap = () => {
		_nodeMap = Object.create(null)
		getNodeList()
			.map(n => _nodeMap[ n.id ] = n)
	}
	buildNodeMap()
	
	const fDerivationMap = (node, fun) => node
		.derivationList
		.map(getNodeByID)
		.map(fun)
	
	const fParentTypeMap = (node, fun) => node
		.parentTypeList
		.map(t => t.elementType.id)
		.map(getNodeByID)
		.map(fun)

	const BaseAddressX64 = 0x140000000n

	function all_SetTypeIDRef() {
		walkAll(n => {
			if ( n.check_(TypeID) ) {
				n.setRef( getNodeByID(n.id) )
				n.setNameForwardOrig( getNodeNameOrigByID(n.id) )
			}
		})
	}
	function all_SetDerivatives() {
		getNodeFilterList(InheritFullNodes).map(n => n => n.derivationClear())
		getNodeFilterList(InheritFullNodes).map(n => n
			.parentTypeList
			.map(t => getNodeByID(t.elementType.id).derivationAdd(n.id) ) )
	}
	function all_SetDependentOnMeSet() {
		getNodeFilterList(InheritFullNodes)
			.map(node => {
				node
					.depsAll
					.map(getNodeByID)
					.filter(Boolean)
					.map(node2 => {
						node2.addDependentOnMeID(node.id)
					})
			})
	}
	function all_SetMemberFuncProcInfo() {
		const procMap = aGroup(lfProcList, p => p.name.replace(/\s*/g, ''))
		
		getNodeFilterList(InheritFullNodes)
			.map(node => node.funcMemberProcess_ProcInfo(procMap) )

		const funcMap = aGroup(astBuilder.nameGroup.funcList
			.filter(p => p.classToks), p => (p.classToks.join('') + '::' + p.nameToks.join('') ).replace(/\s*/g, '') )

		getNodeFilterList(InheritFullNodes)
			.map(node => node.funcMemberProcess_ProcMiniInfo(funcMap) )
	}
	function all_SetStaticMemberDataInfo() {
		const dataMap = aGroup(astBuilder.dataList, p => p.name.replace(/\s*/g, ''))
		
		getNodeFilterList(InheritFullNodes)
			.map(node => node.staticDataMemberProcess_DataInfo(dataMap, true) )
		
		Object
			.values(dataMap)
			.filter(n => n.length === 1)
			.map(n => n[0])
			.map(n => {
				const node = new TypeVar({ id: getUnqID(), name: n.name, elementType: astBuilder.buildType(n.type), })
				node.setAddress( n.addr )
				astBuilder.addType( node )
			})

		buildNodeMap()
		all_SetTypeIDRef()
	}
	function all_SetAbsAddress() {
		walkAll(node => {
			if ( node.instanceof_('WithAddress_') ) {
				if ( node.address ) {
					assert( astBuilder.sectionMap[ node.address.sectionID ] )
					node.address.setAbsAddress( BaseAddressX64 + astBuilder.sectionMap[ node.address.sectionID ].rva + node.address.address )
				}
			}
		})
	}
	function all_NormalizeName() {
		walkAll((node, stack) => {
			if ( node.instanceof_('Name_') ) {
				
				node.setNameOverwriteParts(
					( node.nameOrigIsUnnamed ? 
						[...node.nameOrigPartsWithoutUnnamed, nameRandom('')] : node.nameOrigParts )
						.map(nameNormalize)
						.map(nameNormalizeDefineRules) )

				if ( node.nameOrig !== node.name )
					logger.group('normalize_name').log('Change name\n' +
						textPadStart(
							'OldName: ' + node.nameOrig + '\n' +
							'NewName: ' + node.name     + '\n' +
							stack.toString(), GAP ) )
			}
		})
	}
	function all_SetNestType() {
		const deepNames = mObj({})
		getNodeList()
			.map(node => {
				if ( node.instanceof_('Flags_') )
					if ( node.flags.local )
						return //assert( node.dependentOnMeIDSet.size === 0 )	/// TODO

				let map = deepNames
				node.nameParts.map((n, i, arr) => {
					const cur = ( map[ n ] = map[ n ] || { name: n, nodeList: [], childNodes: mObj({}) } )
					if ( i + 1 < arr.length ) {
						map = cur.childNodes						
						return
					}

					cur.nodeList.push( node )
				})
			})

		const restoreProcNames = []

		const doNodes = (map) => {
			Object
			.entries(map)
			.map(([name, ctx]) => {
				ctx
					.nodeList
					.sort((l, r) => r.dependentOnMeIDSet.size - l.dependentOnMeIDSet.size)
					.slice(1)
					.map(s => {
						const oldName = s.name

						if ( s.check_(TypeEnum) ) {
							s.setIsEnumClass(true)
							logger.group('enum_set_enum_class').log( lf_NodeInfoToStr(s.lfNode) + ` Set enum class(same name)`)
						}
						
						if ( s.check_(TypeProc) ) {
							ctx.nodeList.map(n => n.assert_(TypeProc) )
							restoreProcNames.push([s, s.nameLocal])
						}
						
						while( ctx.nodeList.map(c => c.nameLocal).filter(c => c === s.nameLocal).length > 1 )
							s.setNameOverwriteParts( [...s.nameParts.slice(0, -1), s.nameParts.at(-1) + '$'] )

						logger.group('normalize_name_same').log('Change name\n' +
							textPadStart(
								'OrgName: ' + s.nameOrig + '\n' +
								'OldName: ' + oldName + '\n' +
								'NewName: ' + s.name, GAP ) )
					})
				
				doNodes( ctx.childNodes )
			})
		}
		doNodes(deepNames)
		
		const deep = mObj({})
		getNodeList()
			.map(node => {
				if ( node.instanceof_('Flags_') )
					if ( node.flags.local )
						return ///assert( node.dependentOnMeIDSet.size === 0 )	/// TODO

				let map = deep
				node.nameParts.map((n, i, arr) => {
					const cur = ( map[ n ] = map[ n ] || { name: n, self: null, childNodes: mObj({}) } )
					if ( i + 1 < arr.length ) {
						map = cur.childNodes						
						return
					}
					
					assert( !cur.self )
						
					cur.self = node
				})
			})

		getNodeList()
			.map(node => {
				if ( !node.instanceof_('Flags_') ) return
				if ( !node.flags.local ) return

				let map = deep
				assert( node.nameParts.find((n, i, arr) => {
					const cur = map[ n ]
					if ( !cur || ( cur.self && !cur.self.instanceof_('ChildNodes_') ) ) {
						let lastPart = nameNormalizeDefineRules( nameNormalize( node.nameParts.slice(i).join('_') ) )
						while( map[ lastPart ] )
							lastPart += '$'
						
						const oldName = node.name
						node.setNameOverwriteParts( [...node.nameParts.slice(0, i), lastPart ] )

						logger.group('normalize_name_local').log('Change name\n' +
							textPadStart(
								'OrgName: ' + node.nameOrig + '\n' +
								'OldName: ' + oldName + '\n' +
								'NewName: ' + node.name, GAP ) )
								
						map[ lastPart ] = { name: lastPart, self: node, childNodes: mObj({}) }

						return true
					}
					
					map = cur.childNodes
				}) )
			})

		const walk = (fn, map = deep, parents = []) => Object
			.values(map)
			.map(obj => {
				fn(obj, ...parents)
				walk(fn, obj.childNodes, [obj, ...parents])
			})
		
		walk((obj, ...parents) => {
			if ( !obj.self )
				parents.every(p => assert(!p.self) )
		})
		
		walk((obj, ...parents) => {
			const fullName = [obj.name, ...parents.map(o => o.name)]
				.reverse()
				.join('::')

			if ( !obj.self ) {
				const node = new TypeNamespace({
					id  : getUnqID(),
					name: fullName,
				})
				assert( node.name === fullName )

				astBuilder.addType( node )
				obj.self = node
					
				logger.group('create_namespace').log('Create namespace\n' + GAP+fullName)
			}
		})

		walk((obj, parentNode) => {
			if ( parentNode ) {
				if ( !parentNode.self.check_( TypeNamespace ) ) {
					parentNode.self.addChildNode(obj.self)
					obj.self.setParentNode(parentNode.self)
				}
			}
		})

		restoreProcNames.map(([s, nameLocal]) => s.setNameOverwriteParts( [...s.nameParts.slice(0, -1), nameLocal] ) )
	}
	
	const checkTypeFunction = f => {
		const checkType = t => {
			while( t.check_(TypeModifier) )
				t = t.elementType

			if ( t.check_(TypeID) ) {
				if ( t.ref.check_(TypeEnum) )
					return []
				
				return ['arg/ret pass val struct']
			}
				
			if ( t.check_(TypeArray) )
				return ['arg/ret pass val array']
				
			t.assert_(TypeVoid, TypeScalar, TypePointerTmp, TypePointer)
			
			if ( !t.check_(TypeVoid) )
				assert( t.size <= 8 )

			return []
		}
			
		return [ f.elementType.thisType, f.elementType.returnType, ...f.elementType.argTypeList ]
			.filter(Boolean)
			.map(checkType)
			.flat(1e9)
			.filter(Boolean)
	}
	
	function all_SetMethodsMiss() {
		getNodeFilterList(InheritFullNodes)
			.map(n => n
				.funcMemberList
				.map(m => {
					if ( n.nameOrigLocal === m.nameOrig )
						m.addMissReason('function is constructor')
					
					if ( `~${ n.nameOrigLocal }` === m.nameOrig )
						m.addMissReason('function is destructor')
					
					if ( m.nameOrig.match(/^operator\b/) )
						m.addMissReason(`function is operator`)
					
					if ( m.elementType.isVariadicArgs )
						m.addMissReason(`function have variadic args`)
					
					if ( m.elementType.classType.id !== n.id )
						m.addMissReason(`function invalid class type`)

					if ( m.elementType.thisAdjust !== 0 )
						m.addMissReason(`thisAdjust != 0`)
					
					if ( !m.procInfo && !m.procMiniInfo )
						m.addMissReason(`not found address info`)
					
					if ( [ m.elementType.argTypeList.filter(Boolean), 
							m.elementType.returnType.check_(TypeVoid) ? [] : m.elementType.returnType ]
							.flat(1e9)
							.some(arg => arg.size > 8) )
						m.addMissReason(`arg or ret type is big`)
					
					m.addMissReason( ...checkTypeFunction(m) )
					
					if ( namesFileStorage('block-procedures-or-methods-with-root-namespace.cfg').has( n.nameOrigParts[0] ) )
						m.addMissReason(`block with root "${n.nameOrigParts[0]}"`)

					if ( m.isMiss ) {
						const missInfo = `Remove member function "${ m.nameOrig }" (${ m.isMissInfo })`
					
						logger.group('struct_remove_member_functions').log( lf_NodeInfoToStr(n.lfNode) + '\n' +
							GAP + missInfo )
					}
				}) 
			)
	}
	function all_SetStaticDataMemberMiss() {
		getNodeFilterList(InheritFullNodes)
			.map(n => n
				.staticDataMemberList
				.map(m => {
					if ( m.elementType._ === 'TypeArray' )
						if ( m.elementType.length === 0 )
							m.addMissReason(`invalid array length(zero length)`)
					
					if ( !m.address )
						m.addMissReason(`not found address info`)

					if ( m.isMiss ) {
						logger.group('struct_remove_static_data_member').log( lf_NodeInfoToStr(n.lfNode) + '\n' + 
								GAP + `Cancel member "${ m.nameOrig }" (${ m.isMissInfo })` )
					}
				})
			)
	}
	function all_SetProcedureMiss() {
		getNodeFilterList(TypeProc)
			.map(m => {
				if ( !m.procInfo && !m.procMiniInfo )
					m.addMissReason(`not found address info`)
		
				if ( m.elementType.isVariadicArgs )
					m.addMissReason(`function have variadic args`)

				if ( [ m.elementType.argTypeList.filter(Boolean), 
						m.elementType.returnType.check_(TypeVoid) ? [] : m.elementType.returnType ]
						.flat(1e9)
						.some(arg => arg.size > 8) )
					m.addMissReason(`arg or ret type is big`)
						
				m.addMissReason( ...checkTypeFunction(m) )
					
				if ( namesFileStorage('block-procedures-or-methods-with-root-namespace.cfg').has( m.nameOrigParts[0] ) )
					m.addMissReason(`block with root "${m.nameOrigParts[0]}"`)
					
				if ( m.isMiss )
					logger.group('remove_procedure').log( GAP + `Remove procedure "${ m.nameOrig }" (${ m.isMissInfo })` )
			})
	}
	
	const typeVTabOverStructList = []
	function all_FindVirtualMethods() {
		const getParentsFlat = n => n ?
			[...getParentsFlat(n?.viewParentType?.elementType?.ref), n] : []

		const isNodeVirtMths = n => !n ? 
			false : ( n.vFuncTab ? 
				true : isNodeVirtMths(n.viewParentType) )
			
		
		getNodeFilterList(InheritNodes)
			.map(n => {
				const virtMethodList = []
				
				getParentsFlat(n)
					.map(n => {
						virtMethodList.push(
							...n
								.methodList
								.filter(f => !f.isMiss)
								.filter(f => f.isVfptrOffset)
								.filter(f => !virtMethodList
									.find(f2 => (f2.nameOrig === f.nameOrig) && (f2.signatureWithoutThis === f.signatureWithoutThis) ) )
						)
						
					})
				
				if ( virtMethodList.length ) {
					const vtName = nameRandom( nameNormalize(n.nameOrig) + '_VFUNCTAB_IMP' )
					const elementType = new TypeID({ id: n.id, size: n.size, })
					elementType.setRef(n)
					
					typeVTabOverStructList.push(
						new TypeVTabOverStruct({ 
							name: vtName,
							elementType,
							virtMethodList,
						})
					)
					
					///if ( virtMethodList.length ) console.log(virtMethodList.length)
					n.setViewVirtualMethodList(virtMethodList)
					n.setVirtualOverTabName(vtName)
				}
			})
		
		buildNodeMap()
	}
	
	function all_FindSetUnion() {
		
		function fGroup(arr, structName) {
			let list = []
			
			const inRange = (i, [s, e]) => (s < i) && (i < e)
			const isCmp   = (a, b) => (a[0] === b[0]) && (a[1] === b[1]) && (a[0] < a[1])
			const mBegEnd = m => [ m.offset, m.offset + m.size ]
			
			const findSub = (m) => {
				const m_be = mBegEnd(m )
				
				const cs = list
					.filter(m2 => {
						const m2_be = mBegEnd(m2)
						return inRange(m_be[0], m2_be) || inRange(m_be[1], m2_be) || inRange(m2_be[0], m_be) || inRange(m2_be[1], m_be) || isCmp(m_be, m2_be)
					})
				return cs
			}
			
			arr.map(m => m.__unionList = [])
			arr.map(m => {
				findSub(m).map(m2 => {
					m2.__unionList.push(m )
					m .__unionList.push(m2)
				})
				list.push(m)
			})

			//if ( !list.some(m => m.__unionList.length) )return
			
			const lsstr = list.map(m => m.__unionList.length ? '1' : '0').join('')
				.replace(/1+/g, '1')
				.replace(/0+/g, '0')

			const setListInfo = g => {
				g.offset = Math.min(...g.map(m => m.offset))
				g.size   = Math.max(...g.map(m => m.offset + m.size)) - g.offset
				return g
			}
			const groupByOffset = list => [...list.reduce((map, g) => 
				( map.set(g.offset, [...(map.get(g.offset) ?? []), g]), map ), new Map() ).values() ]

			const Struct = TypeStruct_DataMember_ViewStruct
			const Union  = TypeStruct_DataMember_ViewUnion

			const findUnion = _list => {
				const list = [..._list]

				let hasNestUnions = false
				let unionCandidates = []
				let tmpList = []
				let endOffset = -1
				list.map((m, i) => {
					const prevEndOffset = endOffset
					endOffset = m.offset + m.size

					if ( prevEndOffset <= m.offset ) {
						tmpList.push( m )
						return
					}

					let i2 = -1
					while(1) {
						i2 = aFindLastIndex(tmpList, m2 => m2.offset === m.offset)
						if ( i2 === -1 ) {
							hasNestUnions = true
							assert( unionCandidates.length )
							tmpList = [ ...unionCandidates.pop(), ...tmpList ].flat(1e9)
							continue
						}
						break
					}
					assert( i2 !== -1 )
					
					const unionBlock = tmpList.splice(i2)

					if ( tmpList.length )
						unionCandidates.push(tmpList)
					unionCandidates.push(unionBlock)
					
					tmpList = [m]
				})
				
				if ( !unionCandidates.length )
					return new Struct( ...tmpList )
				
				unionCandidates = new Struct(...unionCandidates.map(m => new Struct(...m)))

				const endElems = tmpList.filter(m => m.offset >= unionCandidates.offset + unionCandidates.size)
				tmpList        = tmpList.filter(m => m.offset <  unionCandidates.offset + unionCandidates.size)
				
				unionCandidates.push( new Struct(...tmpList) )

				const last = unionCandidates.last
				let   unionList = unionCandidates.filter(m => m.offset === last.offset)
				unionCandidates = unionCandidates.filter(m => m.offset !== last.offset)
			
				unionCandidates = findUnion( unionCandidates.flat(1e9) )
				unionList = new Union(...unionList.map(c => findUnion(c)))
				
				const result = new Struct( ...unionCandidates, unionList )
				if ( endElems.length )
					result.push( new Struct(...endElems) )
				
				return result
			}
			const normalizeData = list => {
				const out = []
				if ( list instanceof Union ) {
					list.map(normalizeData).map(o => {
						if ( o instanceof Struct )
							if ( o.length === 1 )
								return out.push( ...o )

						out.push(o)
					})
					return new Union(...out)
				}

				if ( list instanceof Struct ) {
					list.map(normalizeData).map(o => {
						if ( o instanceof Struct )
							return out.push( ...o )
						
						out.push(o)
					})
					
					return new Struct(...out)
				}
				
				return list
			}

			const elementList = list /// .map(l => new Element({ offset: l.offset, size: l.size, name: l.nameOrig, element: l }) )
			const struct = new Struct(...elementList)
			
			const result = normalizeData( findUnion(elementList) )
			result.valid()
			
			const rList = result.flat(1e9)
			assert( arr.length === rList.length )
			arr.map((m, i) => assert( m === rList[i] ) )
			
			return result
		}
		
		const createPadStructProp = (offset, size, memberIndex = 0, rndName = 'gap') =>
			new TypeStruct_DataMember({
				offset     : offset,
				memberIndex: memberIndex,
				flags      : {},
				lfNode     : {}, 
				name       : nameRandomMini(rndName),
				elementType: new TypePadding({ size, })
			})
		
		getNodeFilterList(InheritFullNodes)
			.map(node => {
				if ( !node.dataMemberList.length ) return

				const makeGroupForBitfield = node => {				
					const groupMembers = []
					const dml = [...node.dataMemberList]
					for(let i = 0; i < dml.length; ) {
						const m = dml[i]

						if ( m.elementType._ === 'TypeBitfield' ) {
							let bitOffset = 0
							assert( m.elementType.startingPosition === 0 ) /// TODO
							
							const inlineBitfieldGroup = []
							
							while( i < dml.length ) {
								const m2 = dml[i]
								if ( m2.elementType._ === 'TypeBitfield' ) {
									if ( m2.offset === m.offset ) {
										assert( m2.elementType.elementType._    === m.elementType.elementType._    )
										assert( m2.elementType.elementType.size === m.elementType.elementType.size )
										
										if(0)
										console.log(
											`[${m.offset}:${bitOffset}]`,
											[m2.elementType.startingPosition, m2.elementType.bits],
											m2.elementType.startingPosition + m2.elementType.bits, 
											m2.elementType._, m2.nameOrig 
										)
										
										assert( bitOffset <= m2.elementType.startingPosition )
										if ( bitOffset < m2.elementType.startingPosition ) {
											const bits = m2.elementType.startingPosition - bitOffset
											///console.log( 'create bits ' + bits )
											inlineBitfieldGroup.push( new TypeStruct_DataMember({
												name       : nameRandomMini('pad_bf'), 
												memberIndex: m.memberIndex,
												offset     : m.offset,
												flags      : m.flags,
												elementType: new TypeBitfield({ 
													id              : getUnqID(), 
													elementType     : m.elementType.elementType, /// last bit need unsigned??? TODO
													startingPosition: bitOffset,
													bits,
												})
											}) )
											
											bitOffset = m2.elementType.startingPosition
										}
										
										assert( bitOffset === m2.elementType.startingPosition )
										bitOffset += m2.elementType.bits
										inlineBitfieldGroup.push(m2)
										
										assert( bitOffset <= (m.elementType.elementType.size * 8) )

										i++
										continue
									}
								}
							
								break
							}
							
							groupMembers.push(
								new TypeStruct_DataMember_Group_Bitfield({ 
									offset: m.offset,
									list  : inlineBitfieldGroup,
								})
							)
							continue
						}
						
						groupMembers.push(m)
						i++
					}
					return groupMembers
				}
				
				const list = makeGroupForBitfield(node)
				
				let viewData = fGroup(list, node.nameOrig)
				viewData.assert_( TypeStruct_DataMember_ViewStruct )
				
				viewData.walk(node => {
					if ( node.check_(TypeStruct_DataMember_ViewUnion) ) {
						node.map((v, i) => {
							if ( v.check_(TypeStruct_DataMember_Group_Bitfield) )
								node[i] = new TypeStruct_DataMember_ViewStruct( v )
						})
					}
				})

				viewData.walk(node => {
					if ( node.check_(TypeStruct_DataMember_ViewStruct) ) {
						let offset = node.offset

						const out = []
						node.map((v, i) => {
							if ( offset === v.offset ) {
								out.push(v)
								offset = v.offset + v.size
								return
							}
							
							assert( offset < v.offset )

							const size = v.offset - offset
							out.push( createPadStructProp(offset, size, node[i-1].memberIndex, 'gap') )
							out.push(v)

							offset = v.offset + v.size
						})
						
						out.map((v, i) => node[i] = v)
					}
				})
				
				viewData.assert_(TypeStruct_DataMember_ViewStruct)
				
				if ( node.check_(TypeUnion) ) {
					assert( viewData.length === 1 )
					if ( viewData[0].check_(TypeStruct_DataMember_ViewUnion) )
						viewData = viewData[0]
				}
				
				node.setDataMemberViewList(viewData)
			})
	
	}

	const nodeOrderList = []
	function all_SetOrder() {
		let nodeWthDepsList = []
		let nodeWotDepsList = []
		repeatWhile(() => {
			nodeWthDepsList = getNodeList()
				.filter(n => !n.parentNode)
			nodeWotDepsList = []
			
			let nodeWotDepsSet  = new Set()
			repeatWhile(() => {
				nodeWthDepsList = nodeWthDepsList.filter(n => {
					
					const depsForward = aSub( n.depsAll, n.depsDirect )
						.map(getNodeByID)
						.filter(n => n.parentNode)
						.map(n => n.id)
					
					const depsDirect = aUnq( depsForward, n.depsDirect )
					
					if ( depsDirect.every(id => nodeWotDepsSet.has(id)) ) {
						nodeWotDepsList.push(n)
						n.ids.map(id => nodeWotDepsSet.add(id ) )
						
						return false
					}
					
					return true
				})
				return nodeWthDepsList.length
			})
			
			const dSet = new Set()
			nodeWthDepsList.map(n => {
				const depsForward = aSub( n.depsAll, n.depsDirect )
					.map(getNodeByID)
					.filter(n => n.parentNode)
					.map(n => n.id)

				const depsDirect = aUnq( depsForward, n.depsDirect )
					.filter(id => !nodeWotDepsSet.has(id))

				depsDirect.map(id => dSet.add(id))
			})
			
			;[...dSet].map(getNodeByID).map(n => {
				
				const clearParents = n => {
					if ( !n ) return
					if ( !n.parentNode ) return
					/// clearParents(n.parentNode)

					const name = n.name
					
					const oldName = n.name
					n.setNameOverwriteParts( [nameNormalize(n.name)] )
					logger.group('normalize_name_flat').log('Change name\n' +
							textPadStart(
								'OrgName: ' + n.nameOrig + '\n' +
								'OldName: ' + oldName + '\n' +
								'NewName: ' + n.name, GAP ) )

					logger.group('struct_flat_nest').log( lf_NodeInfoToStr(n.lfNode) + '\n' + 
							textPadStart(
								'Parent : ' + lf_NodeInfoToStr(n.parentNode.lfNode) + '\n' +
								'OrgName: ' + n.nameOrig + '\n' +
								'OldName: ' + oldName + '\n' +
								'NewName: ' + n.name, GAP ) )
					
					const typeUsing = new TypeUsing({
						id: getUnqID(),
						name: name,
						elementType: new TypeID({ id: n.id, size: n.size, }),
					})
					typeUsing.elementType.setRef( n )
					n.parentNode.addChildNode(typeUsing)
					
					n.parentNode.delChildNode(n)
					n.delParentNode()
					
				}
				
				clearParents(n)
			})
			
			console.log( nodeWotDepsList.length, '/', nodeWthDepsList.length )
			
			return nodeWotDepsList.length
		})
		
		assert( !nodeWthDepsList.length )
		
		nodeWotDepsList.map(n => nodeOrderList.push(n))
	}

	const cco = {}
	
	const funGlobalTypeMap = mObj({})
	const funGlobalTypeSet = new Set()
	function all_SetFunGlobalType() {
		const f = f => {
			const fTypeCode = f.elementType.createCodeWithOutTplDeclare(cco, new WalkStack())

			let info = funGlobalTypeMap[ fTypeCode ]
			if ( !info )
				info = funGlobalTypeMap[ fTypeCode ] = [ nameRandomMini('func'), fTypeCode ]
			
			assert( info[1] === fTypeCode )

			funGlobalTypeSet.add( info[1] )
			f.elementType.setGlobalTypeCode( ...info )
		}
		
		getNodeFilterList(InheritFullNodes)
			.map(n => n
				.funcMemberList
				.filter(f => !f.isMiss)
				.map(f) )

		getNodeFilterList(TypeProc)
			.filter(n => !n.isMiss)
			.map(f)
		
		//console.log( 'funGlobalTypeSet: ', funGlobalTypeSet.size, Object.keys(funGlobalTypeMap).length)
		
		
		
		
		const fCheckTypes = n => f => {
			const checkType = t => {
				while( t.check_(TypeModifier) )
					t = t.elementType

				if ( t.check_(TypeID) ) {
					if ( t.ref.check_(TypeEnum) )
						return []
					
					return ['arg/ret pass val struct']
				}
				
				if ( t.check_(TypeArray) )
					return ['arg/ret pass val array']
				
				t.assert_(TypeVoid, TypeScalar, TypePointerTmp, TypePointer)
				
				if ( !t.check_(TypeVoid) )
					assert( t.size <= 8 )

				return []
			}
			
			
			if ( [f.elementType.returnType, ...f.elementType.argTypeList].filter(Boolean).map(checkType).flat(1e9).filter(Boolean).length ) {
				console.log( n.nameOrig )
				console.log( '	', f.nameOrig )
			}
		}
		getNodeFilterList(InheritFullNodes)
			.map(n => n
				.funcMemberList
				.filter(f => !f.isMiss)
				.map(fCheckTypes(n)) )

		getNodeFilterList(TypeProc)
			.filter(n => !n.isMiss)
			.map(n => fCheckTypes(n)(n))
	}


	/// ######################
	const nsWrap = (code, name, ...names) => name ?
		buildLines(
			`namespace ${ name } {`,
			textPadStart( nsWrap(code, ...names), GAP ),
			`}`
		) : code

	const createCodeArray = arrName => itemType => list => list
		.reduce((s, c) => s.addCell(c), buildRowsMaxRow(150))
		.getRows()
		.$next(buildLines)
		.$next(fTextPadStart(GAP))
		.$next(l => buildLines( `${itemType} ${arrName}[${list.length}] = {`, l, `};`, ) )

	const accCodeFSBuilder = () => {
		let list = []

		const getList = () => list
			.map(c => ({...c}))
		const transform = f => list = getList()
			.map(v => f(v))
		const writeToFS = (dir) => getList()
			.map(v => {
				const absFile = path.normalize( path.join(dir, v.file) )
				try {
					fs.mkdirSync( path.dirname(absFile), { recursive: true } )
				} catch {}
				fs.writeFileSync(absFile, v.data)
				console.log(`Write file "${absFile}" len: ${v.data.length}`)
			})
		const add = (file, data) => list.push({ file, data, })
		
		return { getList, transform, writeToFS, add, }
	}
	
	const accCodeFsBld = accCodeFSBuilder()
	
	const getCTpl = n => fs.readFileSync('./CTpl/' + n, 'utf-8')
	
	function all_DumpCodeReflectModule() {
		const acReflectModule = codeFrame()
			.createFileFrame()
			.createNamespaceFrame('Reflect')
		
		const i32u32 = n => (n = n|0, n < 0 ? (2**32) + n : n)

		acReflectModule(`
struct TSection {
	bool         valid           = false;
	uint64_t     rva             = 0;
	uint64_t     size            = 0;
	uint64_t     align           = 0;
	uint64_t     characteristics = 0;
	const char * name            = "";
};`
			.trim()
		)
		
		acReflectModule(`constexpr uint64_t ATFSignature = {ATF_SIGNATURE_U64};`)
		acReflectModule(`constexpr uint64_t BaseAddressExpected = ${ uintToHex(BaseAddressX64) };`)
		astBuilder
			.sectionMap
			.map(s => (!s ? `TSection{},` : 
				`TSection{ true, ${ uintToHex(s.rva) }, ${ uintToHex(s.size) }, ${ uintToHex(s.align) }, ${ uintToHex(i32u32(s.characteristics)) }, "${ s.name }" },`) )
			.$next( buildLines )
			.$next( fTextPadStart(GAP) )
			.$next( s => buildLines( `constexpr std::array< TSection, ${ astBuilder.sectionMap.length } > Sections = {`, s, `};` ) )
			.$next( acReflectModule )
		
		acReflectModule(`const uint64_t BaseAddress = (uint64_t)GetModuleHandleA(nullptr);`)
		
		accCodeFsBld.add('Reflect/AG_Module.hpp', acReflectModule.buildRoot())
	}
	function all_DumpCode() {
		const alDepsSet = new Set()
		let fwdDeps = []
		nodeOrderList.map(n => {
			fwdDeps.push( ...aSub(n.depsAll, n.depsDirect).filter(d => !alDepsSet.has(d)) )
			n.ids.map(id => alDepsSet.add(id))
		})
		fwdDeps = aUnq(fwdDeps)

		const acHeader = codeFrame()
			.createFileFrame()
			.createPackedFrame()

		fwdDeps
			.map(getNodeByID)
			.map(n => ( assert( !n.parentNode ),
					nsWrap( n.typePrefix + ' ' + n.nameLocal + ';', ...n.nameParts.slice(0, -1) ) ) )
			.$next(ls => typeVTabOverStructList
				.map(t => t.elementType.ref.typePrefix + ' ' + t.name + ';')
				.$next(ls2 => [...ls, ...ls2]) )
			.$next( buildLines )
			.$next( acHeader )

		nodeOrderList
			.filter(n => {
				if ( n.check_(TypeVar) )
					return false
					
				if ( n.instanceof_('ParentNode_') )
					if ( n.parentNode )
						return false
						
				return true
			})
			.map(n => nsWrap( n.createCode({}, WalkStack.create(logger)), ...n.nameParts.slice(0, -1) ) )
			.join('\n\n')
			.$next( acHeader )
		
		accCodeFsBld.add('AG_Header.hpp', acHeader.buildRoot())
	}
	function all_DumpCodeSource() {
		const ws = WalkStack.create(logger)
		
		const acSource = codeFrame()
			.createFileFrame()
		
		Object
			.entries(funGlobalTypeMap)
			.map(([id, fc]) => `using ${ fc[0] } = ${ fc[1] };` )
			.$next(buildLines)
			.$next( acSource.createNamespaceFrame('__Local__') )
		
		getNodeFilterList(InheritFullNodes)
			.map(n => n
				.funcMemberList
				.filter(f => !f.isMiss)
				.map(f => f.createCodeImplementation({}, ws, n.name) )
				.$next(buildLines)
				.$next(buildTable)
			)
			.map(acSource)

		typeVTabOverStructList
			.map(t => t.createCode({}, ws))
			.map(acSource)
			
		getNodeFilterList(TypeProc)
			.filter(n => !n.isMiss)
			.map(n => n.createCodeImplementation({}, ws))
			.map(buildTable)
			.map(acSource)
		
		accCodeFsBld.add('AG_Source.cpp', acSource.buildRoot())
	}
	function all_DumpCodeSourceVars() {
		const ws = WalkStack.create(logger)
		
		const acSourceVars = codeFrame()
			.createFileFrame()

		nodeOrderList
			.filter(n => n.check_(TypeVar))
			.map(n => nsWrap( n.createCode({}, ws), ...n.nameParts.slice(0, -1) ) )
			.map(acSourceVars)
		
		acSourceVars('\n\n\n\n')
		
		nodeOrderList
			.filter(n => n.check_(InheritFullNodes))
			.map(n => n
				.staticDataMemberList
				.filter(m => !m.isMiss)
				.map(m => m.createCodeImplementation({}, ws, n.name) )
				.$next(buildLines) )
			.filter(l => l.length)
			.map(buildTable)
			.map(acSourceVars)
		
		accCodeFsBld.add('AG_Vars.cpp', acSourceVars.buildRoot())
	}
	function all_DumpCheckCode() {
		const acCheckCode = codeFrame()
			.createFileFrame()
			.createNamespaceFrame('CheckAll')
			
			
		let codeGroup = ['', '', '']
		const codeGroupFinal = ['', '', '']

		const rc = name => `reinterpret_cast< ${ name }* >( 0xFFFFFF )`
		const sc = (name, ins) => `static_cast< ${ name }* >( ${ ins } )`
		const makeParentsWrap = (parent, child, ...parents) => child ?
			sc( parent, makeParentsWrap(child, ...parents) ) : rc(parent)
		const cSize = (left, size) => `assert( sizeof( *${ left } ) == ${ size } );`
		const cOffset = (left, member, offset) => `assert( (size_t)( &${ left }->${ member } ) == ( 0xFFFFFF + ${ offset } ) );`
		const cOffsetParent = (left, offset) => `assert( (size_t)( ${ left } ) == ( 0xFFFFFF + ${ offset } ) );`
			
		const P = (names, member) => (member ? '&' : ' ' ) + makeParentsWrap(...names) + (member ? `->${member}` : '')
		const V = (names, member) => (member ? ' ' : '*' ) + makeParentsWrap(...names) + (member ? `->${member}` : '')

		const pushCheckSize   = (ins, size  ) => codeGroup[0] += `assert( sizeof(${ ins }) {TD_0}== ${ size } );\n`
		const pushCheckBase   = (ins, offset) => codeGroup[1] += `assert( (size_t)( ${ ins } ) {TD_0}== ( 0xFFFFFF + ${ offset } ) );\n`
		const pushCheckOffset = (ins, offset) => codeGroup[2] += `assert( (size_t)( ${ ins } ) {TD_0}== ( 0xFFFFFF + ${ offset } ) );\n`
		const buildCodeGroup = () => 
			codeGroup = codeGroup
				.map(buildTable)
				.map((s, i) => codeGroupFinal[i] += s)
				.map(s => '')

		getNodeFilterList(InheritFullNodes)
			.map(node => {
				const checkNode = (node, names = [], offset = 0) => {
					pushCheckSize( V(names), node.size )
					pushCheckBase( P(names), offset    )

					node.dataMemberList.map(m => {
						if ( m.isMiss ) return
						if ( m.elementType.check_(TypeBitfield) ) return
								
						pushCheckOffset( P(names, m.nameLocal), offset + m.offset )
						pushCheckSize  ( V(names, m.nameLocal), m.size            )
					})

					buildCodeGroup()
					if ( node.viewParentType )
						checkNode( node.viewParentType.elementType.ref, [node.viewParentType.elementType.ref.name, ...names], offset + node.viewParentType.offset )
				}
				checkNode(node, [node.name], 0)
			})

		acCheckCode(`void checkAll() {`)
			
		;[
			`assert( sizeof(void* ) == 8 );`,
			`assert( sizeof(size_t) == 8 );`,
		]
			.map(fTextPadStart(GAP))
			.map(acCheckCode)

		CTypeList
			.filter(c => !c.void)
			.map(c => buildLines(
				`assert( sizeof(${ c.name }) == ${ c.size } );`,
				(c.name !== 'bool') && 
					`assert( checkIntegerType < ${ c.name } >(${ ['false', 'true '][+c.int] }) );`,
				`assert( checkUnsignedType< ${ c.name } >(${ ['false', 'true '][+c.unsigned] }) );`,
			) )
			.map(fTextPadStart(GAP))
			.map(acCheckCode)

		codeGroupFinal
			.map(fTextPadStart(GAP))
			.map(acCheckCode)
				
		acCheckCode(`}`)

		accCodeFsBld.add('AG_CheckAll.cpp', acCheckCode.buildRoot())
	}

	function all_DumpCodeHookMgr() {
		const ws = WalkStack.create(logger)

		const funcList = []
		const addFunc = n => f => {
			if ( f.isMiss )
				return
			
			if ( f.elementType.isVariadicArgs )
				return

			funcList.push({
				internalID : funcList.length,
				nameParts  : [...(n ? n.nameParts : []), ...f.nameParts],
				elementType: f.elementType,
				address    : f.address,
			})
		}
		
		getNodeFilterList(InheritFullNodes)
			.map(n => n
				.funcMemberList
				.map( addFunc(n) ) )

		getNodeFilterList(TypeProc)
			.map(addFunc())

		const unqFuncMap = mObj({})
		funcList
			.map(f => unqFuncMap[ f.elementType.globalTypeCodeName ] = { elementType: f.elementType } )

		const deepFuncMap = mObj({})
		funcList.map(f => {
			let map = deepFuncMap
			f
				.nameParts
				.slice(0, -1)
				.map(n => {
					map[n] = ( map[n] ?? { nodes: null, childNodes: mObj({}) } ) 
					map = assert( map[n].childNodes )
				})
			
			if ( !map[ f.nameParts.at(-1) ] )
				map[ f.nameParts.at(-1) ] = { nodes: [], childNodes: null }

			map[ f.nameParts.at(-1) ].nodes.push(f)
		})

		const _buildDeepFuncEx = (fMethod, name, map) => buildLines(
			`struct ${ name } {`,
			Object
				.entries(map)
				.map(([n, ctx]) => ctx.nodes ?
					ctx
						.nodes
						.map(fMethod)
						.$next(buildLines) :
					_buildDeepFuncEx( fMethod, n, ctx.childNodes ) )
				.$next(buildLines)
				.$next(fTextPadStart(GAP)),
			`};`
		)
		const buildDeepFuncEx = (name, fMethod) => _buildDeepFuncEx(fMethod, name, deepFuncMap)
		/// ######################################




		const codeWriteBitsFlags = fCrtArr => bits => bits
			.reduce((s, f, i) => s.setBit(i, f), bitsWordMgr(64))
			.getWords()
			.map(w => uintToHex(w, {padStart: 16}) + ', ')
			.$next(fCrtArr('const uint64_t'))
		
		
		function dump_ReflectInfo() {
			const acReflectFuncNameList = codeFrame()
				.createFileFrame()
				.createNamespaceFrame('__Local__')

			const acReflectFuncInfoList = codeFrame()
				.createFileFrame()
				.createNamespaceFrame('__Local__')

			const acReflectFuncInfo = codeFrame()
				.createFileFrame()
				
			funcList
				.map(f => `"${ f.nameParts.join('::') }",`)
				.$next(createCodeArray('__FuncNameList')('const char*'))
				.$next(acReflectFuncNameList)

			acReflectFuncInfoList(`const int32_t __FuncCount = ${ funcList.length };`)		
				
			funcList
				.map(f => `${ cOptBld.castAddr(f.address) }, `)
				.$next(createCodeArray('__FuncAddrList')('const uint64_t'))
				.$next(acReflectFuncInfoList)

			funcList
				.map(f => !f.elementType.thisType)
				.$next(codeWriteBitsFlags(createCodeArray('__FuncIsStaticBitList')))
				.$next(acReflectFuncInfoList)
				
			funcList
				.map(f => !!f.elementType.check_(TypeMFunction))
				.$next(codeWriteBitsFlags(createCodeArray('__FuncIsMethodBitList')))
				.$next(acReflectFuncInfoList)
				
				
			buildDeepFuncEx('FuncInfo', (m, i) => `static TFuncInfo ${ m.nameParts.at(-1) }${ i ? '$'+(i+1) : '' }() { return getFuncInfo(${ m.internalID }); } `)
				.$next(acReflectFuncInfo.createNamespaceFrame('__Local__'))
			
			acReflectFuncInfo.createNamespaceFrame('Reflect')(`using FuncInfo = __Local__::FuncInfo;`)
		
			accCodeFsBld.add('Reflect/AG_FuncNameList.cpp', acReflectFuncNameList.buildRoot())
			accCodeFsBld.add('Reflect/AG_FuncInfoList.cpp', acReflectFuncInfoList.buildRoot())
			accCodeFsBld.add('Reflect/AG_FuncInfo.cpp'    , acReflectFuncInfo.buildRoot())	
		}
		dump_ReflectInfo()
		
		


		////// ##############

		////// ##############
		
		const addCodeHook = codeFrame()
			.createFileFrame()
		const addCodeHookLoc = addCodeHook
			.createNamespaceFrame('__Local__')
			
		const addCodeHookSrc = codeFrame()
			.createFileFrame()
			.createNamespaceFrame('__Local__')		
			
		Object
			.values(unqFuncMap)
			.map(ctx => {
				const { elementType } = ctx
				
				const cnFunc = elementType.globalTypeCodeName

				const cnNext = elementType.globalTypeCodeName + '_next'

				const cnHook = elementType.globalTypeCodeName + '_hook'
				const ccHook = `using ${ cnHook } = ` + elementType.createCodeWithOutTplDeclareEx({}, ws, { backArgs: [{ type: `struct ${cnNext}` }] }) + ';'
				
				let   cnObfr = elementType.globalTypeCodeName + '_obfr'
				let   ccObfr = elementType.createCodeWithOutTplDeclareEx({}, ws, { returnType: 'void' })
				
				if ( elementType.returnType.check_(TypeVoid) ) assert( ccObfr === elementType.globalTypeCode )
				if ( ccObfr === elementType.globalTypeCode   ) elementType.returnType.assert_(TypeVoid)
				ccObfr = `using ${cnObfr} = ${ccObfr};`
				
				let   cnOafr = elementType.globalTypeCodeName + '_oafr'
				let   ccOafr = `using ${ cnOafr } = ` + elementType.createCodeWithOutTplDeclareEx({}, ws, { returnType: 'void', backArgs: [{ type: `{returnType}` }] }) + ';'

				if ( elementType.returnType.check_(TypeVoid) ) {
					cnObfr = elementType.globalTypeCodeName
					ccObfr = null
					
					cnOafr = elementType.globalTypeCodeName
					ccOafr = null
				}
				
				let cnNode = elementType.globalTypeCodeName + '_node'
				let ccNode = `union ${cnNode} { ${cnHook} pHandler; ${cnFunc} pFunc; void* pVoid; };`
				

				
				const ccNext = buildLines(
					`struct ${ cnNext } {`,
					GAP + `const ${ cnNode }* pNode;`,
					GAP + `${ elementType.returnType.createCode({}, ws) } ${ elementType.callConvention } operator() ${
								elementType.createCodeWithOutTplDeclareEx({}, ws, { onlyArgs: true, printName: true, }) 
							} {`,
					GAP + GAP + `if ( pNode[1].pVoid )`,
					GAP + GAP + GAP + `return pNode->pHandler( ${ elementType.createCodeArgsForCall() }${
								elementType.createCodeArgsForCall() ? ',' : ''
							} ${cnNext}{ pNode + 1 } );`,
					GAP + GAP + `return pNode->pFunc( ${ elementType.createCodeArgsForCall() } );`,
					GAP + `}`,
					`};`,
				)

				const code = buildLines( ccHook, ccObfr, ccOafr, ccNode, ccNext )
				
				Object.assign(ctx, {
					cnFunc, cnNext, cnHook, cnNode, cnObfr, cnOafr, code,
				})
			})

		/// 114728
		Object
			.values(unqFuncMap)
			.map(c => c.code)
			.$next(buildLines)
			.$next(addCodeHookLoc)
		
		const buildDeepFunc = (name, map, rule, isRoot = false) => {
			const names = ['']
			const walk = (map, parents = []) => Object
				.entries(map)
				.map(([n, c]) => {
					if ( c.childNodes ) {
						const next = [...parents, n]
						names.push(next.join('.'))
						walk( c.childNodes, next )
					}
				})
			
			if ( isRoot )
				walk(map)
			
			return buildLines(
				`struct ${ !isRoot ? '' : name+'$$$$ ' }{`,
				GAP+`HookMgrViewAPI* $_20da617;`,
				
				textPadStart(
					buildLines(
						isRoot && buildLines(
							`${ name }$$$$(HookMgrViewAPI* pInit) {`,
							buildLines( names.map(n => GAP + `${ [n, '$_20da617'].filter(Boolean).join('.') } = pInit;`) ),
							'}',
						),
						Object
							.entries(map)
							.map(([n, ctx]) => {
								if ( ctx.nodes ) {
									assert( !ctx.childNodes )

									return buildLines( ctx.nodes.map(n => {
										const info = unqFuncMap[ n.elementType.globalTypeCodeName ]
										return `EnumHookState ${ n.nameParts.at(-1) }(${ rule.getType(info) } pHandler) {` +
											` return $_20da617->${ rule.method }(${ n.internalID }, pHandler); }`
									}) )
								}
								
								return buildDeepFunc( n, ctx.childNodes, rule )
							})
					), GAP
				),
				`} ${ name };`
			)
		}
		
		addCodeHookLoc(' ')
		buildLines(
			buildDeepFunc('attachHook'  , deepFuncMap, { method: 'setHook'          , getType: i => i.cnHook }, true),
			buildDeepFunc('attachObsBfr', deepFuncMap, { method: 'setObserverBefore', getType: i => i.cnObfr }, true),
			buildDeepFunc('attachObsAfr', deepFuncMap, { method: 'setObserverAfter' , getType: i => i.cnOafr }, true),
		)
			.$next(l =>	buildLines( 'HookAPI(HookMgrViewAPI* pInit) : attachHook(pInit), attachObsBfr(pInit), attachObsAfr(pInit) {}', l ) )
			.$next(fTextPadStart(GAP))
			.$next(l => buildLines('struct HookAPI {', l, '};') )
			.$next(addCodeHookLoc)

		addCodeHookLoc(' ')
		buildDeepFuncEx('HookFuncNext', (m, i) => `using ${ m.nameParts.at(-1) }${ i ? '$'+(i+1) : '' } = ${
			assert( unqFuncMap[m.elementType.globalTypeCodeName] ).cnNext
		};`)
			.$next(addCodeHookLoc)
		
		addCodeHook.createNamespaceFrame('Hook')(`using FuncNext = __Local__::HookFuncNext;`)
		


		////// ##############
		addCodeHookSrc(`std::array< EternalHandlerListGroup, ${funcList.length} > g_HandlerGroupList;`)
		addCodeHookSrc(' ')
		
		funcList
			.map(f => {
				const info = unqFuncMap[ f.elementType.globalTypeCodeName ]

				info.cnEntryPoint = nameRandomMini('entry_point')
					
				let rcDcl = ''
				let rcNm = ''
				if ( !f.elementType.returnType.check_(TypeVoid) ) {
					rcNm = 'ret'
					rcDcl = f.elementType.returnType.createCode({}, ws) + ` ${rcNm} = `
				}
				const ccars = lst => [f.elementType.createCodeArgsForCall(), lst].filter(Boolean).join(', ')
				return buildLines(
					`${ f.elementType.returnType.createCode({}, ws) } ${f.elementType.callConvention} ${ info.cnEntryPoint }${ f.elementType.createCodeEx({}, ws, { onlyArgs: true, printName: true, }) } {`,
					GAP + `auto pBef = g_HandlerGroupList[${f.internalID}].obsBfrList.getList();`,
					GAP + `while( *pBef )`,
					GAP + GAP + `( reinterpret_cast< ${ info.cnObfr } >( *(pBef++) ) )(${ ccars() });`,
					GAP + `${ rcDcl }( ${ info.cnNext }{ reinterpret_cast< const ${ info.cnNode }* >( g_HandlerGroupList[${f.internalID}].hookList.getList() ) } )(${ ccars() });`,
					GAP + `auto pAft = g_HandlerGroupList[${f.internalID}].obsAfrList.getList();`,
					GAP + `while( *pAft )`,
					GAP + GAP + `( reinterpret_cast< ${ info.cnOafr } >( *(pAft++) ) )(${ ccars(rcNm) });`,
					rcNm ? GAP + `return ${ rcNm };` : '',
					`};`,
				)
			})
			.$next(buildLines)
			.$next(addCodeHookSrc)
		
		addCodeHookSrc(' ')
		funcList
			.map(f => 
				`case ${ f.internalID }: return &${ assert( unqFuncMap[ f.elementType.globalTypeCodeName ] ).cnEntryPoint };`)
			.$next(buildLines)
			.$next(l => buildLines(
				`void* getHookEntryPoint(const int32_t internalID) {`,
					GAP+`switch( internalID ) {`,
						textPadStart(l, GAP+GAP),
					GAP+`}`,
					GAP+`return nullptr;`,
				`}`
			) )
			.$next(addCodeHookSrc)
			
		////// ##############
		accCodeFsBld.add('Hook/AG_Hook.hpp', addCodeHook.buildRoot())
		accCodeFsBld.add('Hook/AG_Hook.cpp', addCodeHookSrc.buildRoot())
	}
	function all_DumpCodeReflectStruct() {
		const typeNameMap = mObj({})
		const typeList = [null]
		const typeCache = (name, type, size = 0, elementTypeID = 0, offset = 0, options = {}, assertUnq = null) => {
			const createType = () => {
				const newType = { id: typeList.length, name, type, size, elementTypeID, offset, ...options, }
				typeList.push( newType )
				return newType
			}

			if ( assertUnq )
				assert( name )

			if ( name ) {
				let cacheType = typeNameMap[ name ]
				
				if ( assertUnq )
					assert( !cacheType )

				if ( !cacheType )
					cacheType = typeNameMap[ name ] = createType()

				return cacheType.id
			}
			
			return createType().id
		}
		const typeCacheGet = name => assert( typeNameMap[ name ] )
		const typeProcess = (t, options = {}) => {
			while( t.check_(TypeModifier) )
				t = t.elementType
			
			if ( t.check_(TypeVoid) )
				return typeCache( 'void', 'TypeVoid', 0 )
			
			if ( t.check_(TypeProcedure) )
				return typeCache( 'void', 'TypeVoid', 0 )
				
			assert( t.size > 0 )

			if ( t.check_(TypeScalar) )
				return typeCache( t.name, 'TypeScalar', t.size )
						
			if ( t.check_(TypeArray) )
				return typeCache( null, 'TypeArray', t.size, typeProcess(t.elementType) )
			
			if ( t.check_(TypePointer) )
				return typeCache( null, 'TypePointer', t.size, typeProcess(t.elementType) )
			
			if ( t.check_(TypePointerTmp) )
				return typeCache( null, 'TypePointer', t.size, typeProcess(t.elementType) )

			if ( t.check_(TypeID) ) {
				if ( t.ref.check_(TypeEnum) )
					return typeProcess(t.ref.elementType)
				
				if ( t.ref.check_(TypeStruct, TypeClass, TypeUnion) )
					return typeCacheGet( t.ref.name ).id

				assert( false )
			}
			
			if ( t.check_(TypeBitfield) )
				return typeCache( null, 'TypeBitfield', t.size, typeProcess(t.elementType), 0, { startingPosition: t.startingPosition, bits: t.bits, } )
			
			assert( false )
		}

		getNodeFilterList(InheritFullNodes)
			.map(n => typeCache(n.name, n._, n.size, 0, 0, { _lfID: n.id, }, true) )

		getNodeFilterList(InheritFullNodes)
			.map(n => {
				const getDataMemberObj = (n, offset = 0) => n ? new Map([
						...getDataMemberObj( ( n.viewParentType && assert(n.viewParentType.offset === 0), n?.viewParentType?.elementType?.ref ) ),
						...n.dataMemberList
							.filter(m => !m.isMiss)
							.reduce((o, m) => ( o.set(m.name, m), o ), new Map() ),
					]) : new Map()

				typeCacheGet( n.name ).fieldIdRng = 
					[...getDataMemberObj(n)]
						.map(e => [...e, typeProcess(e[1].elementType)] )
						.map(([name, m, resType]) => typeCache('', 'TypeDataMemberField', m.elementType.size, resType, m.offset, { fieldName: m.name }) )
						.map(id => ( typeList[id].name = assert(typeList[id].fieldName), id ) )
						.$next(a => a.length ? a : [0, -1])
						.$next(a => [a.at(0), a.at(-1) - a.at(0) + 1])
			})

		getNodeFilterList([TypeVar])
			.filter(n => !n.isMiss)
			.map(n => typeCache(n.name, n._, n.elementType.size, typeProcess(n.elementType), 0, { address: n.address.absAddress, }, true) )

		getNodeFilterList(InheritFullNodes)
			.map(n => {
				const getDataMemberObj = (n, offset = 0) => n ? new Map([
						...getDataMemberObj( ( n.viewParentType && assert(n.viewParentType.offset === 0), n?.viewParentType?.elementType?.ref ) ),
						...n.staticDataMemberList
							.filter(m => !m.isMiss)
							.reduce((o, m) => ( o.set(m.name, m), o ), new Map() ),
					]) : new Map()

				;[...getDataMemberObj(n)]
					.map(e => [...e, typeProcess(e[1].elementType)] )
					.map(([name, m, resType]) => typeCache(
						[...n.nameParts, m.name].join('::'), 'TypeStaticDataMemberField', m.elementType.size, typeProcess(m.elementType), 0, { address: m.address.absAddress, }, true) )
			})

		const EnumTypeMap = {
			TypeVoid    : 1, 
			TypeScalar  : 2,
			TypeBitfield: 3,			

			TypePointer : 4,
			TypeArray   : 5,
			TypeStruct  : 6,
			TypeClass   : 7,
			TypeUnion   : 8,
			
			TypeDataMemberField: 10,
			TypeStaticDataMemberField: 11,
			
			TypeVar: 12,
		}

		const acReflectStructList = codeFrame()
			.createFileFrame()
			.createNamespaceFrame('__Local__')
			.createPackedFrame()

		const createUnqList = () => {
			const map = new Map()
			const list = [null]
			const add = val => {
				if ( map.has(val) )
					return map.get(val)
				
				const id = list.length
				map.set(val, id)
				list.push(val)
				return id
			}
			const getList = () => [...list]
			return { add, getList, }
		}
		
		const bwTypeIndex = binaryWriter()
		const bw = binaryWriter()
			.u8(0)
		const llTypeList = [0]
		const ccNameList = createUnqList()
		typeList.map((t, i) => {
			bwTypeIndex.u32( t ? bw.getOffset() : 0 )
			
			if ( t ) {
				assert( t.id === i )
				
				const typeID = assert( EnumTypeMap[ t.type ] )
				
				llTypeList.push( bw.getOffset() )

				bw
					.u8 ( typeID )
					.u32( t.size )

				t.nameID = t.name ? ccNameList.add(t.name) : 0
				
				if ( ['TypeVoid', 'TypeScalar'].includes(t.type) ) {
					return bw
						.u32( t.nameID           )
				}

				if ( ['TypeStruct', 'TypeClass', 'TypeUnion'].includes(t.type) ) {
					return bw
						.u32( t.nameID           )
						.u32( t.fieldIdRng[0]    )
						.u32( t.fieldIdRng[1]    )
				}
				
				if ( ['TypeBitfield'].includes(t.type) ) {
					return bw
						.u32( t.elementTypeID    )
						.u32( t.startingPosition )
						.u32( t.bits             )
				}
				
				if ( ['TypePointer', 'TypeArray'].includes(t.type) ) {
					return bw
						.u32( t.elementTypeID    )
				}
				
				if ( ['TypeDataMemberField'].includes(t.type) ) {
					return bw
						.u32( t.elementTypeID    )
						.u32( t.nameID           )
						.u32( t.offset           )
				}
				
				if ( ['TypeStaticDataMemberField', 'TypeVar'].includes(t.type) ) {
					return bw
						.u32( t.elementTypeID    )
						.u32( t.nameID           )
						.u64( t.address          )
				}

				assert( false )
			}
		})
		Array(1024).fill(0).map( bw.u8 )

		acReflectStructList(`const int32_t __StructInfoCount = ${ typeList.length };`)

		ccNameList
			.getList()
			.map(n => `"${ n ?? '' }", `)
			.$next( createCodeArray('__StructInfoNameList')('const char*') )
			.$next( acReflectStructList )

		bw
			.getU64List()
			.map(w => uintToHex(w, {padStart: 16}) + ', ')
			.$next( createCodeArray('__StructInfoDataMemory')('const uint64_t') )
			.$next( acReflectStructList )
		
		bwTypeIndex
			.getU64List()
			.map(w => uintToHex(w, {padStart: 16}) + ', ')
			.$next( createCodeArray('__StructInfoOffsetDataMemory')('const uint64_t') )
			.$next( acReflectStructList )
		
		accCodeFsBld.add('Reflect/AG_StructInfoList.cpp', acReflectStructList.buildRoot())


		const acReflectStructDumpList = codeFrame()
			.createFileFrame()
			.createNamespaceFrame('Reflect')

		typeList
			.filter(Boolean)
			.filter(t => ['TypeStruct', 'TypeClass', 'TypeUnion'].includes(t.type))
			.map(t => [
				`auto dumpStruct(const ${t.name}* pObj, const TStructDumperOptions& dumperOptions = {}) {`,
				`return dumpStruct(getStructNode(${t.id}), (const uint8_t*)pObj, dumperOptions);`,
				`}`,
			].join(' '))
			.map(acReflectStructDumpList)
			
		accCodeFsBld.add('Reflect/AG_StructInfo.cpp', acReflectStructDumpList.buildRoot())
	}
	
	function all_PostProcessCInclude() {
		readFilesDeepInDirFlat(path.join(__dirname, '../CInclude'))
			.map(f => accCodeFsBld.add(f.name, f.data.toString('utf-8')))
	}
	function all_PostProcessSingature() {
		const atfSignature = accCodeFsBld
			.getList()
			.reduce((s, v) => s + v.data, '')
			.$next(hashSHA256)
			.slice(0, 8*2)
			.$next(s => '0x' + s)

		accCodeFsBld
			.transform(v => v
				.data
				.replace(/\{ATF_SIGNATURE_U64\}/g, atfSignature)
				.$next(data => ({ ...v, data }) ) )
	}
	
	
	
	const progress = (...fns) => fns
		.map(f => ( console.time( '  '+f.name ), f(), console.timeEnd( '  '+f.name ) ) )

	progress(
		all_SetTypeIDRef,
		all_SetDerivatives,
		all_SetDependentOnMeSet,
		all_SetMemberFuncProcInfo,
		all_SetStaticMemberDataInfo,
		all_SetAbsAddress,
		
		all_SetMethodsMiss,
		all_SetStaticDataMemberMiss,
		all_SetProcedureMiss,
		
		all_NormalizeName,
		all_SetNestType,
			all_FindVirtualMethods,
		all_FindSetUnion,
		all_SetOrder,
		
		all_SetFunGlobalType,
			
			all_DumpCodeReflectStruct,
		
		all_DumpCodeReflectModule,
		all_DumpCode,
		all_DumpCodeSource,
		all_DumpCodeSourceVars,
		all_DumpCheckCode,
			all_DumpCodeHookMgr,		
		
		///// 
		all_PostProcessCInclude,
		all_PostProcessSingature,
	)

	accCodeFsBld.writeToFS(outDir)

}

export function lf_AstProcessing(astBuilder, logger, outDir) {
	AstProcessing( astBuilder, logger, outDir )
}

export function lf_Build(pdb, logger) {	
	const builder = new Builder(logger)
	builder.build( pdb )
	
	return builder
}
