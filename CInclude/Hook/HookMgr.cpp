#pragma once

namespace ATF {
	namespace __Local__ {
		class EternalHookMgrAPI : public EternalHookMgrViewAPI {
			private:
				std::mutex                 _mutex;
				std::atomic< TFunSetHook > _pFunSetHook = nullptr;
		
			protected:
				virtual EnumHookState attachHandlerFinal(const THookRequestProcess* pHookReq, const TFuncInfo& funcInfo) override {
						std::lock_guard< std::mutex > lg(_mutex);
						
						auto pFunSetHook = _pFunSetHook.load();
						if ( !pFunSetHook )
							return EnumHookState::ErrorInternal;
						
						const uint64_t gateAddr = (uint64_t)__Local__::getHookEntryPoint(funcInfo.internalID);
						if ( !gateAddr )
							return EnumHookState::ErrorInternal;
						
						THookRequestRecord hookReq{ funcInfo.address, gateAddr };
						return __Local__::g_HandlerGroupList[ funcInfo.internalID ]
							.attachHandler( hookReq, pFunSetHook, pHookReq->eHookType, pHookReq->handlerAddr ) ?
								EnumHookState::Done : EnumHookState::ErrorInternal;
					}
				virtual EnumHookState detachHandlerFinal(const THookRequestProcess* pHookReq, const TFuncInfo& funcInfo) override {
						std::lock_guard< std::mutex > lg(_mutex);
						
						return __Local__::g_HandlerGroupList[ funcInfo.internalID ]
							.detachHandler( pHookReq->handlerAddr ) ?
								EnumHookState::Done : EnumHookState::ErrorInternal;
					}

			public:
				ATF_NON_COPYABLE_CLASS(EternalHookMgrAPI)
				EternalHookMgrAPI() : 
					EternalHookMgrViewAPI("", EnumHookAccessFlags::AllAccess, nullptr) {}
					
				virtual void __CC_CDECL getFuncInfo(TFuncInfo* pOutFuncInfo, const int32_t internalID) const override {
						*pOutFuncInfo = __Local__::getFuncInfo(internalID);
					}

				void onSetHook(TFunSetHook pSetHook) {
						_pFunSetHook.store(pSetHook);
					}
		};
		
		class EternalHookMgrEx : public Hook::EternalHookMgr {
			private:
				EternalHookMgrAPI* const _pHookApi = nullptr;

			public:
				EternalHookMgrEx(EternalHookMgrAPI* pHookApi) : 
					_pHookApi(pHookApi), EternalHookMgr(pHookApi) {}

				void onSetHook(TFunSetHook pSetHook) {
					_pHookApi->onSetHook(pSetHook);
				}
		};

		EternalHookMgrEx g_EternalHookMgrViewAPIWrapper( new EternalHookMgrAPI() );
	}
	
	namespace Hook {
		
		__Local__::EternalHookMgrEx& getEternalHookMgr() {
			return __Local__::g_EternalHookMgrViewAPIWrapper;
		}
	
	}
}