
/// #########################################################################
/// #########################################################################
/// #########################################################################
const types = [
  'LF_CLASS',			/// +	+	+
  'LF_POINTER',			/// +	+	+
  'LF_ARGLIST',			/// +	+	+
  'LF_MFUNCTION',		/// +	+	+
  'LF_STRUCTURE',		/// +	+	+
  'LF_ARRAY',			/// +	+	+
  'LF_FIELDLIST',		/// +	+
  'LF_PROCEDURE',		/// +	+	+
  'LF_MODIFIER',		/// +	+	+
  'LF_ENUM',			/// +	+	+
  'LF_VTSHAPE',			/// +	+	+
  'LF_METHODLIST',		/// +	+	+
  'LF_UNION',			/// +	+	+
  'LF_BITFIELD',		/// +	+	+
]
const structParams = [
  'FORWARD REF',
  'NESTED',
  'PACKED',
  'CONSTRUCTOR',
  'OVERLOAD',
  'OVERLOADED ASSIGNMENT',
  'CASTING',
  'CONTAINS NESTED',
  'LOCAL'
]
const fieldTypes = [
  'LF_MEMBER',	
  'LF_ONEMETHOD',
  'LF_ENUMERATE',
  'LF_VFUNCTAB',
  'LF_NESTTYPE',
  'LF_STATICMEMBER',
  'LF_METHOD',
  'LF_BCLASS',
  'LF_VBCLASS',
  'LF_IVBCLASS'
]



/// #########################################################################
/// #########################################################################
/// #########################################################################
class LF_Flags_ {
	_getNames() {
		return Object
			.keys(this)
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
	_init(params) {
		if ( !params.length )
			return

		const names = Object.fromEntries( this._getNames() )
		params.map(p => {
			const _p = p
				.toUpperCase()
				.replace(/^\(/, '')
				.replace(/\)$/, '')
				.replace(/^_*/, '')

			const key = names[ _p ]
			if ( !key )
				throw new Error('[LF_Flags] Invalid flag "' + p + '"')
				
			this[ key ] = true
		})

		Object.freeze(this)
	}

	toString() {
		return this
			._getNames()
			.map(n => this[n[1]] ? n[0] : '')
			.filter(Boolean)
			.join(', ')
	}
}
export class LF_StructFlags extends LF_Flags_ {
	constructor_         = false
	overload             = false
	overloadedAssignment = false
	forwardRef           = false
	nested               = false
	containsNested       = false
	packed               = false
	casting              = false
	local                = false
	
	////
	sealed = false
	hfaDouble = false

	constructor(params = {}) {
		super()
		this._init(params)
	}
}
export class LF_PointerFlags extends LF_Flags_ {
	const_    = false
	unaligned = false
	volatile  = false
	
	singleInheritance       = false
	multipleInheritance     = false
	virtualInheritance      = false
	mostGeneral             = false

	pointer                 = false
	lValueReference         = false
	pointerToMemberFunction = false
	pointerToMemberData     = false

	constructor(params = {}) {
		super()
		this._init(params)
	}
}
export class LF_ModifierFlags extends LF_Flags_ {
	const_    = false
	unaligned = false
	volatile  = false

	constructor(params = {}) {
		super()
		this._init(params)
	}
}
export class LF_MemberFlags extends LF_Flags_ {
	private            = false
	protected          = false
	public             = false
	vanilla            = false
	compgenx           = false
	virtual            = false
	pureVirtual        = false
	introducingVirtual = false
	pureIntro          = false
	static             = false
	
	constructor(params = {}) {
		super()
		this._init(params)
	}
}



/// #########################################################################
/// #########################################################################
/// #########################################################################