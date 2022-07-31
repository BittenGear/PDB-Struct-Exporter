import net from 'net'

/// #########################
const PromiseEx = () => {
	let resolve, reject
	let promise = new Promise((res, rej) => {
		resolve = res
		reject = rej
	})
	Object.assign(promise, { resolve, reject, })
	return promise
}
function ReallocWriteBuffer(initSize = 1024) {
	let buf = Buffer.allocUnsafe(initSize)
	let writeOffset = 0
	let readOffset  = 0

	const capacity           = () => buf.length
	const availableSizeRead  = () => writeOffset - readOffset
	const availableSizeWrite = () => capacity()  - writeOffset

	const setNewBuf = newBuf => {
		buf.slice(readOffset, writeOffset).copy(newBuf)

		buf = newBuf
		writeOffset -= readOffset
		readOffset   = 0
	}
	const write = appendBuf => {
		const appendSize = appendBuf.length

		if ( availableSizeWrite() < appendSize )
			setNewBuf( Buffer.allocUnsafe( capacity() * 2 + appendSize ) )

		appendBuf.copy( buf.slice(writeOffset) )
		writeOffset += appendSize
	}
	const read = (fun) => {
		const realRead = fun( buf.slice(readOffset, writeOffset) )
		if ( realRead <= 0 )
			return false

		readOffset += realRead
		if ( readOffset === writeOffset )
			readOffset = writeOffset = 0

		if ( readOffset > 0.8 * capacity() )
			setNewBuf( buf )
		
		return true
	}

	return { write, read, _getBuffer: () => buf }
}
function MessageBuffer(onMessage) {
	let rwb = ReallocWriteBuffer(1024*1024)
	
	return aBuf => {
		rwb.write(aBuf)
		
		while( 
			rwb.read(data => {
				if ( 4 <= data.length ) {
					const msgSize = data.readInt32LE(0)
					if ( msgSize <= data.length ) {
						try {
							onMessage( data.slice(4, msgSize) )
						} catch(e) {
							console.error(e)
						}
						return msgSize
					}
				}
				
				return 0
			}) 
		) ;
	}
}
async function createReadMemoryAPI(port = 10200, host = '127.0.0.1') {
	let nextRpcID = 1
	const rpcMap = Object.create(null)
	const fMsgBuf = MessageBuffer(msgData => {
		if ( 8 <= msgData.length ) {
			const cmdID = msgData.readInt32LE(0)
			const rpcID = msgData.readInt32LE(4)
			if ( cmdID === 2 ) {
				const promise = rpcMap[rpcID]
				if ( promise ) {
					delete rpcMap[rpcID]
					
					msgData = msgData.slice(8)
					while( msgData.length && msgData[ msgData.length - 1 ] === 0 )
						msgData = msgData.slice(0, -1)
								
					const data = msgData.toString('utf-8')
					if ( data[0] === '#' )
						promise.resolve( {error: data} )
								
					try {
						promise.resolve( JSON.parse(data) )
					} catch(e) {
						promise.resolve( {error: e.message} )
					}
				}
			}
		}
	})
	const getReqReadMemBuf = (code, rpcID) => {
		const buf = Buffer.allocUnsafe(4+4+4+ code.length + 1)
		buf.writeInt32LE(buf.length, 0)
		buf.writeInt32LE(1, 4)
		buf.writeInt32LE(rpcID, 8)
		Buffer.from(code).copy( buf.slice(12) )
		buf[buf.length-1] = 0
		return buf
	}

	return new Promise((res, rej) => {
		try {

			const socket = net.createConnection(port, host, () => {

				const dumpMemory = async (code) => {
					const rpcID = (nextRpcID++)|0
					const promise = PromiseEx()

					rpcMap[ rpcID ] = promise
					socket.write( getReqReadMemBuf(code, rpcID) )
					//console.log('write!')
					return promise
				}
				
				res({ 
					dumpMemory, 
					getSocket: () => socket,
				})
			})
			.on('data', fMsgBuf)

		} catch(e) {
			rej(e)
		}
	})
}
/// #########################

async function main() {
	const { dumpMemory } = await createReadMemoryAPI(10200, '127.0.0.1')
	
	
	/// ....
	
}
main()

