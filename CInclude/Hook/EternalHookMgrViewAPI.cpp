#pragma once

namespace ATF {
	namespace Hook {
		
		class EternalHookMgr : public __Local__::HookAPI {
			private:
				__Local__::EternalHookMgrViewAPI* const _pHookApi = nullptr;

			public:
				EternalHookMgr(__Local__::EternalHookMgrViewAPI* pMgr) : _pHookApi(pMgr), HookAPI(pMgr) {}
				
				const char* getName() const { return _pHookApi->getName(); }

				void enableAccessFlag (const int32_t flag) { _pHookApi->enableAccessFlag (flag); }
				void disableAccessFlag(const int32_t flag) { _pHookApi->disableAccessFlag(flag); }
				void onInform(TFunInform funUpdate) { return _pHookApi->onInform(funUpdate); }
				
				EnumHookState detach(const void* pHandler) {
					return _pHookApi->detach(pHandler);
				}
				EnumHookState detachAll() {
					return _pHookApi->detachAll();
				}

				EternalHookMgr* createEternalView(const std::string& name, const int32_t accessFlags) {
					return new EternalHookMgr(
						new __Local__::EternalHookMgrViewAPI( name, accessFlags, static_cast< __Local__::EternalHookApiBase* >(_pHookApi) ) );
				}
				
				void* getEternalViewExternal() {
					return reinterpret_cast< void* >( static_cast< __Local__::EternalHookApiBase* >(_pHookApi) );
				}
		};

		EternalHookMgr* createEternalView(void* pParent) {
			return new EternalHookMgr(
				new __Local__::EternalHookMgrViewAPI( "", EnumHookAccessFlags::AllAccess, reinterpret_cast< __Local__::EternalHookApiBase* >(pParent) ) );
		}

	}
}