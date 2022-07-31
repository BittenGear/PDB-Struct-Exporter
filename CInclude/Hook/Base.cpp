#pragma once

#include "Constants.hpp"
#include "Structs.hpp"
#include "EternalHandlerList.cpp"

namespace ATF {
	namespace __Local__ {
		
		using EnumHookState = Hook::EnumHookState;
		using EnumHookMode = Hook::EnumHookMode;
		using EnumHookType = Hook::EnumHookType;
		using EnumHookAccessFlags = Hook::EnumHookAccessFlags;
		using TFunInform = Hook::TFunInform;
		using TNameList = Hook::TNameList;
		using TAttachInfo = Hook::TAttachInfo;
		using TInformRecord = Hook::TInformRecord;

		struct THookRequestProcess {
			EnumHookMode                    eHookMode   = EnumHookMode::Attach;
			const class EternalHookApiBase* pChildFinal = nullptr;
			
			uint64_t                        handlerAddr = 0;

			EnumHookType                    eHookType   = EnumHookType::Hook;
			int32_t                         internalID  = -1;
		};

		class EternalHookApiBase {
			public:
				virtual bool                      __CC_CDECL checkATFSignature(const uint64_t atfSignature) const = 0;
				virtual bool                      __CC_CDECL checkHookVersion(const TVersion* pHookVersion) const = 0;
				virtual const char*               __CC_CDECL getName() const = 0;
				virtual const EternalHookApiBase* __CC_CDECL getParent() const = 0;
				virtual void                      __CC_CDECL getFuncInfo(TFuncInfo* pOutFuncInfo, const int32_t internalID) const = 0;

				virtual EnumHookState             __CC_CDECL processHandler(const THookRequestProcess* pHookReq) = 0;
				virtual void                      __CC_CDECL processHandlerInform(const THookRequestProcess* pHookReq, const TFuncInfo* pFuncInfo, const EnumHookState eHookState) const = 0;
		};

		class EternalHookApiBaseWithParams : public EternalHookApiBase {
			private:
				std::string         const _name = "";
				EternalHookApiBase* const _pParent = nullptr;

			protected:
				EternalHookApiBase* getParentMtb() { return _pParent; }

			public:
				EternalHookApiBaseWithParams(const std::string& name = "", EternalHookApiBase* pParent = nullptr) : _name(name), _pParent(pParent) {}

				virtual bool                      __CC_CDECL checkATFSignature(const uint64_t atfSignature) const override {
					if ( atfSignature != Reflect::ATFSignature )
						return false;
					
					if ( getParent() )
						return getParent()->checkATFSignature(atfSignature);
					
					return true;
				}
				virtual bool                      __CC_CDECL checkHookVersion(const TVersion* pHookVersion) const override {
					if ( !pHookVersion )
						return false;
					
					if ( !pHookVersion->compare(Hook::HookVersion) )
						return false;
					
					if ( getParent() )
						return getParent()->checkHookVersion(pHookVersion);
					
					return true;
				}
				virtual const char*               __CC_CDECL getName() const override { return _name.c_str(); }
				virtual const EternalHookApiBase* __CC_CDECL getParent() const override { return _pParent; }
				virtual void                      __CC_CDECL getFuncInfo(TFuncInfo* pOutFuncInfo, const int32_t internalID) const override {
					if ( getParent() )
						getParent()->getFuncInfo(pOutFuncInfo, internalID);
				}
		};
		class EternalHookApiBaseWithInform : public EternalHookApiBaseWithParams {
			private:
				std::atomic< TFunInform > _pFunInform = nullptr;
			
			public:
				EternalHookApiBaseWithInform(const std::string& name = "", EternalHookApiBase* pParent = nullptr) : 
					EternalHookApiBaseWithParams(name, pParent) {}


				static auto getNameParts(const EternalHookApiBase* pChildFinal) {
					TNameList nameParts;
					while( pChildFinal ) {
						if ( strlen(pChildFinal->getName()) )
							nameParts.insert( nameParts.begin(), pChildFinal->getName() );
						
						pChildFinal = pChildFinal->getParent();
					}

					return nameParts;
				}

				virtual void __CC_CDECL processHandlerInform(const THookRequestProcess* pHookReq, const TFuncInfo* pFuncInfo, const EnumHookState eHookState) const override {
					if ( getParent() )
						getParent()->processHandlerInform(pHookReq, pFuncInfo, eHookState);

					const auto pFunInform = _pFunInform.load();
					if ( !pHookReq ) return;
					if ( !pFuncInfo ) return;
					if ( !pFunInform ) return;
					
					if ( !pFuncInfo->valid ) return;
					
					pFunInform( TInformRecord{
						pHookReq->eHookMode,
						pHookReq->handlerAddr,
						
						getNameParts(pHookReq->pChildFinal),
						
						*pFuncInfo,
						eHookState,
						
						pHookReq->eHookType,
					} );
				}
				
				void onInform(TFunInform funInform) {
					_pFunInform.store(funInform);
				}
		};

		class TAttachInfoList {
			private:
				std::vector< TAttachInfo > _list;
				
			public:
				TAttachInfo get(const uint64_t handlerAddr) const {
					auto it = std::find_if( _list.begin(), _list.end(), [&](const auto& item) { return item.handlerAddr == handlerAddr; } );
					if ( it != _list.end() )
						return *it;
					
					return TAttachInfo{};
				}
				bool has(const uint64_t handlerAddr) const {
					return get(handlerAddr).valid;
				}
				bool remove(const uint64_t handlerAddr) {
					if ( !has(handlerAddr) )
						return false;
					
					_list.erase( std::remove_if( _list.begin(), _list.end(), [&](const auto& item) { return item.handlerAddr == handlerAddr; } ), _list.end() );
					return true;
				}
				bool push_front(const TAttachInfo& ai) {
					if ( has(ai.handlerAddr) )
						return false;
					
					_list.insert(_list.begin(), ai);
					return true;
				}
				
				auto getList() { return _list; }
		};		
		class EternalHookMgrViewAPI : public EternalHookApiBaseWithInform {
			private:
				std::recursive_mutex      _mutex;
				int32_t                   _accessFlags = 0;
				TAttachInfoList           _attachInfoList;

				EnumHookState _attachHandlerCommon(TFuncInfo& outFuncInfo, const THookRequestProcess* pHookReq) {
					switch( pHookReq->eHookType ) {
						case EnumHookType::Hook  : if ( !( _accessFlags & EnumHookAccessFlags::AttachHook   ) ) return EnumHookState::ErrorAccess; break;
						case EnumHookType::ObsBfr: if ( !( _accessFlags & EnumHookAccessFlags::AttachObsBfr ) ) return EnumHookState::ErrorAccess; break;
						case EnumHookType::ObsAfr: if ( !( _accessFlags & EnumHookAccessFlags::AttachObsAfr ) ) return EnumHookState::ErrorAccess; break;
						default: 
							return EnumHookState::ErrorInternal;
					}

					getFuncInfo(&outFuncInfo, pHookReq->internalID);
					if ( !outFuncInfo.valid )
						return EnumHookState::ErrorInternal;
					
					if ( _attachInfoList.has(pHookReq->handlerAddr) )
						return EnumHookState::ErrorAlreadyExists;
					
					const EnumHookState rState = attachHandlerFinal(pHookReq, outFuncInfo);
					
					if ( rState == EnumHookState::Done ) {
						_attachInfoList.push_front(TAttachInfo{
							true,
							pHookReq->eHookType,
							pHookReq->handlerAddr,
							outFuncInfo,
							getNameParts(pHookReq->pChildFinal),
						});
					}
					
					return rState;
				}
				EnumHookState _detachHandlerCommon(TFuncInfo& outFuncInfo, const THookRequestProcess* pHookReq) {
					const auto ai = _attachInfoList.get(pHookReq->handlerAddr);
					if ( !ai.valid )
						return EnumHookState::ErrorNotFound;
					
					outFuncInfo = ai.funcInfo;
					
					const EnumHookState rState = detachHandlerFinal(pHookReq, ai.funcInfo);
					if ( rState == EnumHookState::Done )
						_attachInfoList.remove(pHookReq->handlerAddr);
					
					return rState;
				}
				
				EnumHookState _processHandlerCommon(TFuncInfo& outFuncInfo, const THookRequestProcess* pHookReq) {
					outFuncInfo.valid = false;
					
					if ( !pHookReq )
						return EnumHookState::ErrorInternal;

					if ( !pHookReq->pChildFinal )
						return EnumHookState::ErrorInternal;

					if ( !pHookReq->handlerAddr )
						return EnumHookState::ErrorInternal;
					
					if ( !checkATFSignature(Reflect::ATFSignature) )
						return EnumHookState::ErrorDifferentATFSignature;
					
					if ( !checkHookVersion(&Hook::HookVersion) )
						return EnumHookState::ErrorDifferentHookVersion;

					switch( pHookReq->eHookMode ) {
						case EnumHookMode::Attach:
							return _attachHandlerCommon(outFuncInfo, pHookReq);
						
						case EnumHookMode::Detach:
							return _detachHandlerCommon(outFuncInfo, pHookReq);
					}
					
					return EnumHookState::ErrorInternal;
				}

				EnumHookState _processHandlerWrapper(const THookRequestProcess* pHookReq) {
					std::lock_guard< std::recursive_mutex > lg(_mutex);
					
					TFuncInfo funcInfo;
					const EnumHookState rState = _processHandlerCommon(funcInfo, pHookReq);
					
					if ( funcInfo.valid )
						processHandlerInform(pHookReq, &funcInfo, rState);

					return rState;
				}

			protected:
				virtual EnumHookState attachHandlerFinal(const THookRequestProcess* pHookReq, const TFuncInfo& funcInfo) { 
					return getParentMtb() ? getParentMtb()->processHandler(pHookReq) : EnumHookState::ErrorInternal;
				}
				virtual EnumHookState detachHandlerFinal(const THookRequestProcess* pHookReq, const TFuncInfo& funcInfo) { 
					return getParentMtb() ? getParentMtb()->processHandler(pHookReq) : EnumHookState::ErrorInternal; 
				}


			
			public:
				EternalHookMgrViewAPI(std::string name, int32_t accessFlags = 0, EternalHookApiBase* pParent = nullptr) :
					EternalHookApiBaseWithInform(name, pParent), _accessFlags(accessFlags) {}
					
				virtual EnumHookState __CC_CDECL processHandler(const THookRequestProcess* pHookReq) override {
					std::lock_guard< std::recursive_mutex > lg(_mutex);
					
					TFuncInfo funcInfo;
					return _processHandlerCommon(funcInfo, pHookReq);
				}

				void enableAccessFlag (const int32_t flag) {
					std::lock_guard< std::recursive_mutex > lg(_mutex);
					_accessFlags |= flag; 
				}
				void disableAccessFlag(const int32_t flag) {
					std::lock_guard< std::recursive_mutex > lg(_mutex);
					_accessFlags &= ~flag; 
				}
				
				std::string getInfoText() {
					std::lock_guard< std::recursive_mutex > lg(_mutex);
						
					const auto addrToHex = [](const auto addr) -> std::string {
						std::ostringstream stm;
						stm << ( (void*)addr );
						return "[0x" + stm.str() + "]";
					};
					
					const auto list = _attachInfoList.getList();
					const auto dumpHookType = [=](auto eHookType) {
						std::map< int32_t, std::vector< TAttachInfo > > map;
						
						const std::string GAP = "    ";
						for(const auto& ai : list)
							if ( ai.eHookType == eHookType )
								map[ ai.funcInfo.internalID ].push_back(ai);
						
						std::string text = enumHookTypeToString(eHookType) + " list("+ std::to_string(map.size()) +")\n";
						for(auto rec : map) {
							text += GAP + addrToHex(rec.second[0].funcInfo.address) + " " + rec.second[0].funcInfo.name + "\n";
							for(auto ai : rec.second)
								text += GAP+GAP + addrToHex(ai.handlerAddr) + " Name: \"" + ai.buildName() + "\"\n";
						}
						
						return text;
					};
					
					return 
						dumpHookType(EnumHookType::Hook  ) + 
						dumpHookType(EnumHookType::ObsBfr) + 
						dumpHookType(EnumHookType::ObsAfr) ;
				}

				EnumHookState detachAll() {
					std::lock_guard< std::recursive_mutex > lg(_mutex);
					
					const auto list = _attachInfoList.getList();
					for(const auto& ai : list) {
						const EnumHookState rState = _processHandlerWrapper(&THookRequestProcess{ EnumHookMode::Detach, this, ai.handlerAddr, });
						if ( rState != EnumHookState::Done )
							return rState;
					}
					return EnumHookState::Done;
				}

				/// ###########################
				EnumHookState setHook(const int32_t internalID, const void* pHandler) {
					return _processHandlerWrapper(&THookRequestProcess{ EnumHookMode::Attach   , this, (uint64_t)pHandler, EnumHookType::Hook,   internalID, });
				}
				EnumHookState setObserverBefore(const int32_t internalID, const void* pHandler) {
					return _processHandlerWrapper(&THookRequestProcess{ EnumHookMode::Attach   , this, (uint64_t)pHandler, EnumHookType::ObsBfr, internalID, });
				}
				EnumHookState setObserverAfter(const int32_t internalID, const void* pHandler) {
					return _processHandlerWrapper(&THookRequestProcess{ EnumHookMode::Attach   , this, (uint64_t)pHandler, EnumHookType::ObsAfr, internalID, });
				}
				EnumHookState detach(const void* pHandler) {
					return _processHandlerWrapper(&THookRequestProcess{ EnumHookMode::Detach   , this, (uint64_t)pHandler, });
				}
		};

		using HookMgrViewAPI = EternalHookMgrViewAPI;
		
	}
}