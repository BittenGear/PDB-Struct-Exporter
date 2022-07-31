
import { assert, asUIntValid } from '../Helpers.js'

const PDFTypeMap = Object.assign(Object.create(null), {
		'T_BOOL08(0030)': 'bool',
		
		'T_RCHAR(0070)' : 'char',
		'T_WCHAR(0071)' : 'uchar16_t',
		
		'T_CHAR16(007A)': 'uchar16_t', /// unicode char
		'T_CHAR32(007B)': 'uint32_t', /// unicode char
		
		'T_CHAR(0010)'  : 'int8_t',
		'T_UCHAR(0020)' : 'uint8_t',
		
		
		'T_SHORT(0011)' : 'int16_t',
		'T_LONG(0012)'  : 'int32_t',
		'T_INT4(0074)'  : 'int32_t',
		'T_QUAD(0013)'  : 'int64_t',
		
		'T_USHORT(0021)': 'uint16_t',
		'T_ULONG(0022)' : 'uint32_t',
		'T_UINT4(0075)' : 'uint32_t',
		'T_UQUAD(0023)' : 'uint64_t',
		'T_UINT8(0077)' : 'uint64_t',
		
		'T_HRESULT(0008)': 'HRESULT',
		
		'T_REAL32(0040)': 'float32_t',
		'T_REAL64(0041)': 'float64_t',
		
		
		
		'T_64PINT4(0674)'  : 'int32_t*',
		'T_64PUINT4(0675)' : 'uint32_t*',
		'T_64PRCHAR(0670)' : 'char*',
		'T_64PWCHAR(0671)' : 'uchar16_t*',
		'T_64PBOOL08(0630)': 'bool*',
		'T_64PUCHAR(0620)' : 'uint8_t*',
		'T_64PSHORT(0611)' : 'int16_t*',
		'T_64PUSHORT(0621)': 'uint16_t*',
		'T_64PULONG(0622)' : 'uint32_t*',
		'T_64PVOID(0603)'  : 'void*',
		
		'T_64PLONG(0612)'  : 'int32_t*',
		
		'T_64PQUAD(0613)'  : 'int64_t*',
		'T_64PUQUAD(0623)' : 'uint64_t*',
		
		'T_64PREAL32(0640)': 'float32_t*',
		'T_64PREAL64(0641)': 'float64_t*',
		
		'T_64PHRESULT(0608)': 'HRESULT*', 
		
		'T_64PCHAR(0610)':  'int8_t*',
		
		'T_64PCHAR32(067B)': 'uint32_t*', 
		
		'T_PVOID(0103)': 'void*',
		
		'T_64PCHAR16(067A)': 'uchar16_t*',
		
		///
		'T_VOID(0003)': 'void',
})
const TypeSizeMap = {
	char: 1, bool: 1, uchar16_t: 2,
		 
	int8_t : 1, uint8_t : 1,
	int16_t: 2, uint16_t: 2,
	int32_t: 4, uint32_t: 4,
	int64_t: 8, uint64_t: 8,
		 
	float32_t: 4, float64_t: 8,
	 
	HRESULT: 4,
	
	void: 0,
}

export class LF_Type {
	typeID   = 0
	typeName = null
	size     = null

	typeOrig = ''
	typePtr  = false
	
	_fromLfType(typeOrig) {
		this.typeOrig = typeOrig
		
		if ( typeOrig.startsWith('0x') ) {
			this.typeID = asUIntValid( parseInt(typeOrig, 16) )
		} else if ( typeOrig.startsWith('T_') ) {
			this.typeName = PDFTypeMap[typeOrig]
			
			if ( !this.typeName )
				throw new Error(`Invalid type(lf) "${typeOrig}"`)
			
			assert( this.typeName )
			
			if ( this.typeName.endsWith('*') ) {
				this.typeName = this.typeName.slice(0, -1)
				this.typePtr  = true
				//this.size     = 8
			}
			
			this.size = TypeSizeMap[ this.typeName ]
			this.size = asUIntValid( this.size )
		}
	}
	
	constructor(typeOrig) {
		if ( typeof typeOrig === 'string' ) {
			this._fromLfType(typeOrig)
		} else {
			assert( false )
		}
		
		Object.freeze( this )
	}
}
