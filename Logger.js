
import fs from 'fs'
import path from 'path'

const getDateStr = () => {
	const d = new Date()
	return d.toLocaleDateString() + " " + d.toLocaleTimeString() + "." + String(+d % 1000).padStart(3, 0)
}

class LoggerBaseEmpty {
	write() {}
}
class LoggerBase {
	#dir = ''
	#commonFile = ''
	
	constructor(options) {
		this.#dir = options.dir
		this.#commonFile = path.join( this.#dir, options.commonFile )
		
		fs.mkdirSync(this.#dir, { recursive: true })
		if ( options.firstClear )
			fs.rmSync(this.#dir, { recursive: true })
		fs.mkdirSync(this.#dir, { recursive: true })
	}
	
	write(type, text, group = null) {
		const data = [...[ getDateStr(), type, group, ].filter(Boolean).map(c => `[${c}]`), text]
			.join(' ')
			.replace(/[\r\n]*$/, '') + '\n'

		fs.appendFileSync(this.#commonFile, data)
		if ( group )
			fs.appendFileSync(path.join( this.#dir, group + '.log' ), data)
	}
}

export class Logger {
	_loggerBase = null
	_group = null
	_type = 'notice'

	constructor(options, ex) {
		if ( ex )
			return Object.assign(this, ex)
		
		this._loggerBase = new LoggerBase(options)
	}

	group  (name) { return new Logger(null, { ...this, _group: name, }) }
	
	log    (text) { this._loggerBase.write(null     , text, this._group) }
	notice (text) { this._loggerBase.write('Notice ', text, this._group) }
	warning(text) { this._loggerBase.write('Warning', text, this._group) }
	error  (text) { this._loggerBase.write('Error  ', text, this._group) }
	
	static createEmpty() {
		return new Logger(null, { _loggerBase: new LoggerBaseEmpty() })
	}
}
