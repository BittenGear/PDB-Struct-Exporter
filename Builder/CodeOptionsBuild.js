
let options = {}

export const getOptions = () => ({ ...options })
export const setOptions = _options => options = { ..._options }

export const castType = (typeDst, typeSrc) => 
	getOptions().useReinterpretCast ? 
		`reinterpret_cast< ${typeDst} >( ${typeSrc} )` :
		`(${typeDst})(${typeSrc})`

export const castAddr = address =>
	getOptions().useRelativeAddress ? 
		address.addressCode : 
		address.absAddressCode

export const cOptBld = { getOptions, setOptions, castType, castAddr, }
