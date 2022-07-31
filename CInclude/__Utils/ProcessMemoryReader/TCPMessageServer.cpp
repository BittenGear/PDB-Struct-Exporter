#pragma once

#pragma comment(lib, "ws2_32.lib")

namespace ProcessMemoryReader {
	namespace TCPMessageServer {
		namespace __Local__ {

		namespace WSAInit {
			std::mutex _mutex;
			bool       _init = false;
			WSAData    _wsaData = {0};
			
			WinError wsaStartup() {
				std::lock_guard< std::mutex > lg(_mutex);
				
				if ( _init )
					return WinError{ "WSAStartup", false };
				
				if ( ::WSAStartup(MAKEWORD(2,2), &_wsaData) )
					return WinError{ "WSAStartup", true, (DWORD)WSAGetLastError() };
				
				_init = true;
				
				return WinError{ "WSAStartup", false };
			}
		};

		class MessageData {
			private:
				static constexpr size_t LeftSysSize = 64;
				static constexpr size_t MinSizeReserve = 4096;

				std::vector< uint8_t > _data;
				size_t                 _readOffset  = LeftSysSize;
				size_t                 _writeOffset = LeftSysSize;
				
				void _checkRealloc(const size_t appendSize) {
					while( _data.size() < _writeOffset + appendSize )
						_data.resize( _data.size() * 2 + MinSizeReserve );
				}

			public:
				ATF_NON_COPYABLE_CLASS(MessageData)
				
				using SP_MessageData = std::shared_ptr< MessageData >;

				MessageData() {
					_data.resize(MinSizeReserve);
				}

				void append(const uint8_t* pData, const size_t size) {
					_checkRealloc(size);

					memcpy(&_data[_writeOffset], pData, size);
					_writeOffset += size;
				}
				template< class T >
				void append(const T& data) {
					append( (const uint8_t*)&data, sizeof(data) );
				}
				
				
				auto getWriteBlock(const size_t minSize = MinSizeReserve) {
					_checkRealloc( ( minSize < MinSizeReserve ) ? MinSizeReserve : minSize );
					
					return std::make_pair( &_data[_writeOffset], _data.size() - _writeOffset );
				}
				void setWriteBlockSize(const size_t size) {
					_writeOffset += size;
				}
				
				auto getData() const {
					return std::make_pair( &_data[_readOffset], size() );
				}
				
				auto getReadBlock() {
					auto pData = &_data[ _readOffset - 4 ];
					*( (uint32_t*)pData ) = size() + 4;
					return std::make_pair( (const uint8_t*)pData, size() + 4 );
				}
				
			
				
				auto readMessage() {
					SP_MessageData finalMsg = nullptr;
					
					const uint8_t* pReadData    = &_data[ _readOffset ];
					const size_t   readDataSize = size();

					if ( 4 <= readDataSize ) {
						const auto msgSize = *reinterpret_cast< const uint32_t* >( pReadData );
						if ( msgSize <= readDataSize ) {
							finalMsg = std::make_shared< MessageData >();
							finalMsg->append(pReadData + 4, msgSize - 4);
							
							_readOffset += msgSize;
						}
					}
					
					return finalMsg;
				}
				auto rebuild() {
					SP_MessageData msg = nullptr;
					
					if ( _readOffset == _writeOffset ) {
						_readOffset = _writeOffset = LeftSysSize;
						return msg;
					}
					
					if ( _readOffset > ( (size_t)((float)_data.size() * 0.8) ) ) {
						msg = std::make_shared< MessageData >();
						msg->append( getData().first, size() );
					}
					
					return msg;
				}
				
				size_t size() const { return _writeOffset - _readOffset; }
		};
		using SP_MessageData = std::shared_ptr< MessageData >;
		auto CreateMessageData() {
			return std::make_shared< MessageData >();
		}
		
		template< class T >
		class QueueSafeThread {
			private:
				std::mutex       _mutex;
				std::vector< T > _list;
				size_t           _popIndex = 0;
			
				void _rebuild() {
					if ( _popIndex > (size_t)((float)_list.size() * 0.8) ) {
						_list.erase( _list.begin(), _list.begin() + _popIndex );
						_popIndex = 0;
					}
				}
			public:
				void push_back(T item) {
					std::lock_guard< std::mutex > lg(_mutex);
					
					_list.push_back(item);
				}
				auto pop_front() {
					std::lock_guard< std::mutex > lg(_mutex);
					
					T empty;
					
					const size_t size = _list.size() - _popIndex;
					if ( !size )
						return std::make_pair(false, empty);

					auto ret = _list[ _popIndex ];
					_list[ _popIndex ] = empty;
					
					_popIndex++;
					_rebuild();
					return std::make_pair(true, ret);
				}
		};

		struct TClientRecord {
			enum Type {
				Open,
				Close,
				Message,
			};
			
			Type           eType        = Message;
			uint64_t       clientID     = 0;
			SOCKET         clientSocket = INVALID_SOCKET;
			SP_MessageData messageData  = nullptr;
		};
		using TClientRecordQueueSafeThread = QueueSafeThread< TClientRecord >;
		using SP_TClientRecordQueueSafeThread = std::shared_ptr< TClientRecordQueueSafeThread >;

		using TAtomicBool = std::atomic< bool >;
		using SP_TAtomicBool = std::shared_ptr< TAtomicBool >;
				
		struct ClientContext {
			uint64_t                        const clientID              = 0;
			SOCKET                          const clientSocket          = INVALID_SOCKET;
			SP_TAtomicBool                  const spIsThrExitAtomic     = false;
			SP_TClientRecordQueueSafeThread const spSendQueueSafeThread = nullptr;
			SP_TClientRecordQueueSafeThread const spRecvQueueSafeThread = nullptr;

			ClientContext(
				const uint64_t                  clientID_, 
				const SOCKET                    clientSocket_,
				SP_TAtomicBool                  spIsThrExitAtomic_,
				SP_TClientRecordQueueSafeThread spSendQueueSafeThread_,
				SP_TClientRecordQueueSafeThread spRecvQueueSafeThread_
			) :
				clientID(clientID_), 
				clientSocket(clientSocket_),
				spIsThrExitAtomic(spIsThrExitAtomic_),
				spSendQueueSafeThread(spSendQueueSafeThread_),
				spRecvQueueSafeThread(spRecvQueueSafeThread_)
				{}


			std::thread thrSend;
			std::thread thrRecv;
		};
		using SP_ClientContext = std::shared_ptr< ClientContext >;
		
		class ClientContextMgrThreadSafe {
			private:
				std::mutex                                       _mutex;
				std::unordered_map< uint64_t, SP_ClientContext > _map;
			
				void _rebuild() {
					std::vector< uint64_t > delKeyList;
					for(auto rec : _map) {
						auto spClientContext = rec.second;
						if ( spClientContext->spIsThrExitAtomic->load() ) {
							if ( spClientContext->thrSend.joinable() ) spClientContext->thrSend.join();
							if ( spClientContext->thrRecv.joinable() ) spClientContext->thrRecv.join();
							delKeyList.push_back(rec.first);
						}
					}
					for(auto key : delKeyList) {
						_map.erase(key);
					}
				}					
			
			public:
				void add(SP_ClientContext spClientContext) {
					std::lock_guard< std::mutex > lg(_mutex);
					
					_map[ spClientContext->clientID ] = spClientContext;
				}
				SP_ClientContext get(const uint64_t key) {
					std::lock_guard< std::mutex > lg(_mutex);
					
					if ( _map.find(key) == _map.end() )
						return nullptr;
					
					return _map[ key ];					
				}
				
				void rebuild() {
					std::lock_guard< std::mutex > lg(_mutex);
					
					_rebuild();
				}
				void clear() {
					std::lock_guard< std::mutex > lg(_mutex);
					
					for(auto rec : _map) {
						auto spClientContext = rec.second;
						::closesocket(spClientContext->clientSocket);
						spClientContext->spIsThrExitAtomic->store(true);
					}
					_rebuild();
				}
		};
		using SP_ClientContextMgrThreadSafe = std::shared_ptr< ClientContextMgrThreadSafe >;

		class TCPMessageServer {
			private:
				enum EnumState {
					SVInit,
					SVOpen,
					SVClose,
				};

				using TAtomicState = std::atomic< EnumState >;
				using SP_TAtomicState = std::shared_ptr< TAtomicState >;

				std::mutex      _mutex;
				SOCKET          _svSocket = INVALID_SOCKET;
				SP_TAtomicState _spEnumStateAtomic = std::make_shared< TAtomicState >( SVInit );
				
				std::thread     _thrAccept;
				std::thread     _thrClientControl;
				
				SP_ClientContextMgrThreadSafe   _spClientMgrSafeThread = std::make_shared< ClientContextMgrThreadSafe >();
				SP_TClientRecordQueueSafeThread _spRecvQueueSafeThread = std::make_shared< TClientRecordQueueSafeThread >();


				static bool _checkSocketFuncResult(const int32_t status, const size_t dataSize) {
					return !( (status == SOCKET_ERROR) || (status == 0) || (status < 0) || (status > dataSize) );
				}

				struct TThreadOptions {
					uint64_t                        clientID          = 0;
					SOCKET                          clientSocket      = INVALID_SOCKET;
					SP_TClientRecordQueueSafeThread spQueueSafeThread = nullptr;
					SP_TAtomicBool                  spIsThrExitAtomic = nullptr;
				};				
				static void _Thread_ClientSend(TThreadOptions thrOptions) {
					auto _send = [](const auto clientSocket, const uint8_t* pData, size_t dataSize) {
						while( dataSize ) {
							const auto status = ::send( clientSocket, (const char*)pData, dataSize, 0 );
							if ( !_checkSocketFuncResult(status, dataSize) )
								return false;
												
							pData    += status;
							dataSize -= status;
						}
						
						return true;
					};

					while( !thrOptions.spIsThrExitAtomic->load() ) {
						auto rec = thrOptions.spQueueSafeThread->pop_front();
						auto cl = rec.second;
						
						if ( rec.first ) {
							if ( cl.clientID == thrOptions.clientID ) {
								if ( cl.eType == TClientRecord::Message ) {
									if ( cl.messageData ) {
										if ( cl.messageData->size() ) {
											const auto msgRec = cl.messageData->getReadBlock();
											if ( !_send(thrOptions.clientSocket, msgRec.first, msgRec.second) )
												break;
											
											continue;
										}
									}
								}
							}
						}
						
						Sleep(1);
					}

					/// ###############
					thrOptions.spIsThrExitAtomic->store(true);
					::closesocket( thrOptions.clientSocket );
				}
				static void _Thread_ClientRecv(TThreadOptions thrOptions) {
					thrOptions.spQueueSafeThread->push_back({ TClientRecord::Open, thrOptions.clientID, thrOptions.clientSocket, });
					
					auto commonReadMsgData = CreateMessageData();

					while( !thrOptions.spIsThrExitAtomic->load() ) {
						auto rec = commonReadMsgData->getWriteBlock(1024*1024);

						const auto status = ::recv(thrOptions.clientSocket, (char*)rec.first, rec.second, 0);
						if ( !_checkSocketFuncResult(status, rec.second) )
							break;

						commonReadMsgData->setWriteBlockSize(status);
						
						while( true ) {
							auto msg = commonReadMsgData->readMessage();
							if ( !msg )
								break;
							
							thrOptions.spQueueSafeThread->push_back({ TClientRecord::Message, thrOptions.clientID, thrOptions.clientSocket, msg, });
						}
						
						auto newRmd = commonReadMsgData->rebuild();
						if ( newRmd )
							commonReadMsgData = newRmd;
					}
					
					thrOptions.spQueueSafeThread->push_back({ TClientRecord::Close, thrOptions.clientID, thrOptions.clientSocket, });
					
					/// ###############
					thrOptions.spIsThrExitAtomic->store(true);
					::closesocket( thrOptions.clientSocket );
				}
				
				struct TThreadAcceptOptions {
					SOCKET                          serverSocket          = INVALID_SOCKET;
					SP_ClientContextMgrThreadSafe   spClientMgrSafeThread = nullptr;
					SP_TClientRecordQueueSafeThread spRecvQueueSafeThread = nullptr;
					SP_TAtomicState                 spEnumStateAtomic     = nullptr;
				};
				static void _Thread_Accept(TThreadAcceptOptions thrOptions) {
					uint64_t nextClientID = 1;

					auto fNewClient = [&](const uint64_t clientID, const auto clientSocket) {
						auto spIsThrExitAtomic     = std::make_shared< TAtomicBool >( false );
						auto spSendQueueSafeThread = std::make_shared< TClientRecordQueueSafeThread >();
						
						auto spClientContext = std::make_shared< ClientContext >( 
							clientID, 
							clientSocket,
							spIsThrExitAtomic,
							spSendQueueSafeThread,
							thrOptions.spRecvQueueSafeThread
						);

						spClientContext->thrSend = std::thread(_Thread_ClientSend, TThreadOptions{
							clientID,
							clientSocket,
							spSendQueueSafeThread, 
							spIsThrExitAtomic
						});

						spClientContext->thrRecv = std::thread(_Thread_ClientRecv, TThreadOptions{
							clientID,
							clientSocket,
							thrOptions.spRecvQueueSafeThread,
							spIsThrExitAtomic
						});
					
						thrOptions.spClientMgrSafeThread->add( spClientContext );
					};
					
					while( thrOptions.spEnumStateAtomic->load() == SVOpen ) {
						const SOCKET clSocket = accept(thrOptions.serverSocket, NULL, NULL);
						if ( clSocket == INVALID_SOCKET )
							break;
						
						fNewClient(nextClientID++, clSocket);
						thrOptions.spClientMgrSafeThread->rebuild();
					}
										
					thrOptions.spClientMgrSafeThread->clear();
					
					/// ################
					::closesocket(thrOptions.serverSocket);
				}

				static void _Thread_ClientControl(SP_ClientContextMgrThreadSafe spClientMgrSafeThread, SP_TAtomicState spEnumStateAtomic) {
					while( spEnumStateAtomic->load() == SVOpen ) {
						spClientMgrSafeThread->rebuild();
						Sleep(1000);
					}
				}


			public:
				ATF_NON_COPYABLE_CLASS(TCPMessageServer)
				
				TCPMessageServer() {}
				
				auto bind(const std::string& host, const uint16_t port) {
					std::lock_guard< std::mutex > lg(_mutex);

					if ( _spEnumStateAtomic->load() != SVInit ) return ErrorState{ "eState != SVInit" };

					const auto fRet = [&](auto ret) {
						if ( _svSocket != INVALID_SOCKET ) {
							::closesocket(_svSocket);
							_svSocket = INVALID_SOCKET;
						}
						
						return ErrorState{ ret };
					};
					
					const auto err = WSAInit::wsaStartup();
					if ( err.fail() )
						return fRet( err );

					_svSocket = ::socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
					if ( _svSocket == INVALID_SOCKET )
						return fRet( WinError{ "socket", true, (DWORD)WSAGetLastError() } );

					sockaddr_in saServer = {0};
					saServer.sin_family      = AF_INET;
					saServer.sin_addr.s_addr = ::inet_addr(host.c_str());
					saServer.sin_port        = ::htons(port);
					
					if ( ::bind(_svSocket, (SOCKADDR*)&saServer, sizeof(saServer)) )
						return fRet( WinError{ "bind", true, (DWORD)WSAGetLastError() } );

					if ( listen(_svSocket, SOMAXCONN) )
						return fRet( WinError{ "listen", true, (DWORD)WSAGetLastError() } );
					
					_spEnumStateAtomic->store(SVOpen);

					_thrAccept = std::thread(_Thread_Accept, TThreadAcceptOptions{
						_svSocket,
						_spClientMgrSafeThread,
						_spRecvQueueSafeThread,
						_spEnumStateAtomic,
					});
			
					_thrClientControl = std::thread(_Thread_ClientControl, _spClientMgrSafeThread, _spEnumStateAtomic);

					return ErrorState{};
				}
				
				auto close() {
					std::lock_guard< std::mutex > lg(_mutex);
					
					if ( _spEnumStateAtomic->load() != SVOpen ) return ErrorState{ "eState != SVInit" };

					_spEnumStateAtomic->store(SVClose);

					if ( _svSocket != INVALID_SOCKET )
						::closesocket(_svSocket);					

					if ( _thrAccept.joinable() )
						_thrAccept.join();

					if ( _thrClientControl.joinable() )
						_thrClientControl.join();

					return ErrorState{};
				}
			
				~TCPMessageServer() {
					close();
				}
				
				auto readMessage() {
					std::lock_guard< std::mutex > lg(_mutex);
					
					return _spRecvQueueSafeThread->pop_front();
				}
				bool sendMessage(const uint64_t clientID, SP_MessageData msgData) {
					std::lock_guard< std::mutex > lg(_mutex);
					
					if ( !msgData )
						return false;
					
					if ( !msgData->size() )
						return false;
					
					auto spClientContext = _spClientMgrSafeThread->get( clientID );
					if ( !spClientContext )
						return false;
					
					spClientContext->spSendQueueSafeThread->push_back({
						TClientRecord::Message,
						spClientContext->clientID,
						spClientContext->clientSocket,
						msgData,
					});
					return true;
				}
		};
		using SP_TCPMessageServer = std::shared_ptr< TCPMessageServer >;

		}
		
		using MessageData = __Local__::MessageData;
		using SP_MessageData = __Local__::SP_MessageData;

		using SP_TCPMessageServer = __Local__::SP_TCPMessageServer;
		auto CreateTCPMessageServer(const std::string& host, const uint16_t port) {
			auto sv = std::make_shared< __Local__::TCPMessageServer >();
			
			auto err = sv->bind(host, port);
			if ( err.fail() )
				sv = nullptr;
			
			return std::make_pair(err, sv);
		}

	}
}