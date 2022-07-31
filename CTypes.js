
import { assert, asUIntValid, mObj, } from './Helpers.js'

class CType_Category {
	int   = false
	float = false
	char  = false
	void  = false

	constructor(initData) {
		this.int   = !!initData.int
		this.float = !!initData.float
		this.char  = !!initData.char
		this.void  = !!initData.void
	}
}
class CType_Scalar extends CType_Category {
	size     = 0
	unsigned = false

	constructor(initData) {
		super(initData)
		
		this.name     = String(initData.name)
		this.size     = asUIntValid(initData.size)
		this.unsigned = !!initData.unsigned
		
		Object.freeze(this)
	}
}

const unsigned = true
const int      = true
const float    = true
const char     = true

export const CTypeList = [
	/// number int types
	new CType_Scalar({ name: 'int8_t'   , size: 1, int, }),
	new CType_Scalar({ name: 'int16_t'  , size: 2, int, }),
	new CType_Scalar({ name: 'int32_t'  , size: 4, int, }),
	new CType_Scalar({ name: 'int64_t'  , size: 8, int, }),

	new CType_Scalar({ name: 'uint8_t'  , size: 1, int, unsigned, }),
	new CType_Scalar({ name: 'uint16_t' , size: 2, int, unsigned, }),
	new CType_Scalar({ name: 'uint32_t' , size: 4, int, unsigned, }),
	new CType_Scalar({ name: 'uint64_t' , size: 8, int, unsigned, }),
	
	/// number float types
	new CType_Scalar({ name: 'float32_t', size: 4, float, }),
	new CType_Scalar({ name: 'float64_t', size: 8, float, }),
	
	/// bool
	new CType_Scalar({ name: 'bool'     , size: 1, int, unsigned, }),

	/// real char types
	new CType_Scalar({ name: 'char'     , size: 1, int, char, }),
	new CType_Scalar({ name: 'uchar16_t', size: 2, int, char, unsigned, }),		/// alias on uint16_t
	
	/// alias
	new CType_Scalar({ name: 'HRESULT'  , size: 4, int, }),		/// alias on int32_t
	
	/// void
	new CType_Scalar({ name: 'void'     , size: 0, void: true, }),
]
export const CTypeMap = mObj( Object.fromEntries(CTypeList.map(c => [c.name, c])) )

Object.freeze(CTypeList)
Object.freeze(CTypeMap)

const CCallConvention_CDECL = '__CC_CDECL'

export const CCallConventionMap = {
	'C Near'  : CCallConvention_CDECL,
	__cdecl   : CCallConvention_CDECL,
	__CC_CDECL: CCallConvention_CDECL,
}
Object.freeze(CCallConventionMap)
