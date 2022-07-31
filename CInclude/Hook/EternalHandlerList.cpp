#pragma once

#include "Constants.hpp"
#include "Structs.hpp"

namespace ATF {
	namespace __Local__ {

		using THookRequestRecord = Hook::THookRequestRecord;
		using THookResultRecord  = Hook::THookResultRecord;
		using TFunSetHook        = Hook::TFunSetHook;
		using EnumHookType       = Hook::EnumHookType;

		class EternalHandlerList final {
			friend class EternalHandlerListGroup;

			private:
				std::atomic< uint64_t > _pHead = 0;

				void _setList(const uint64_t* pList) {
					_pHead.store( reinterpret_cast< uint64_t >(pList) );
				}
				void _fromVector(const std::vector< uint64_t >& list) {
					auto pNewList = new uint64_t[ list.size() + 1 ];
					pNewList[ list.size() ] = 0;
					
					for(size_t i = 0; i != list.size(); i++)
						pNewList[i] = list[i];
					
					_setList(pNewList);
				}
				auto _toVector() const {
					std::vector< uint64_t > list;
					const uint64_t* pItem = getList();
					for(auto pItem = getList(); *pItem; pItem++)
						list.push_back( *pItem );
					return list;
				}
				
				template< class TFun >
				void _vectorUpdate(TFun fun) {
					auto list = _toVector();
					fun(list);
					_fromVector(list);
				}

				size_t size() const {
					return _toVector().size();
				}
				bool has(const uint64_t item) const {
					for(auto item2 : _toVector())
						if ( item == item2 )
							return true;
					return false;
				}
				bool remove(const uint64_t item) {
					if ( !has(item) )
						return false;
					
					_vectorUpdate([&](auto& list) {
						list.erase( std::remove_if( list.begin(), list.end(), [&](auto item2) { return item == item2; } ), list.end() );
					});
					
					return true;
				}
				bool push_front(const uint64_t item) {
					if ( has(item) )
						return false;
					
					_vectorUpdate([&](auto& list) {
						list.insert(list.begin(), item);
					});
					
					return true;
				}

			public:
				ATF_NON_COPYABLE_CLASS(EternalHandlerList)
				EternalHandlerList() {
					static uint64_t nop = 0;
					_setList( &nop );
				}

				const uint64_t* getList() const {
					return reinterpret_cast< const uint64_t* >( _pHead.load() );
				}
		};
		class EternalHandlerListGroup final {
			private:
				std::mutex        _mutex;
				THookResultRecord _hookInfo;
				
				auto _each() {
					struct rr {
						EnumHookType        eHookType;
						EternalHandlerList& list;
					};

					return std::array< rr, 3 >{ 
						rr{ EnumHookType::Hook  , hookList  , },
						rr{ EnumHookType::ObsBfr, obsBfrList, },
						rr{ EnumHookType::ObsAfr, obsAfrList, },
					};
				}

				bool _init(const THookRequestRecord& hookReq, const TFunSetHook funSetHook) {
					if ( _hookInfo.valid )
						return true;
					
					if ( !funSetHook )
						return false;
					
					hookList.push_front( _hookInfo.detourAddr );
					
					_hookInfo = funSetHook(hookReq);
					if ( !_hookInfo.valid ) {
						hookList.remove( _hookInfo.detourAddr );
						return false;
					}
					
					return true;
				}
				
				bool _hasHandler(const uint64_t handlerAddr) {
					for(auto rec : _each())
						if ( rec.list.has(handlerAddr) )
							return true;
					
					return false;
				}
			
			public:
				ATF_NON_COPYABLE_CLASS(EternalHandlerListGroup)
				EternalHandlerListGroup() {}
				
				EternalHandlerList hookList;
				EternalHandlerList obsBfrList;
				EternalHandlerList obsAfrList;
				
				bool attachHandler(const THookRequestRecord& hookReq, const TFunSetHook funSetHook, const EnumHookType eHookType, const uint64_t handlerAddr) {
					std::lock_guard< std::mutex > lg(_mutex);

					if ( !_init(hookReq, funSetHook) )
						return false;

					if ( _hasHandler(handlerAddr) )
						return false;
					
					for(auto rec : _each())
						if ( rec.eHookType == eHookType )
							return rec.list.push_front(handlerAddr);
					
					return false;
				}
				bool detachHandler(const uint64_t handlerAddr) {
					std::lock_guard< std::mutex > lg(_mutex);

					for(auto rec : _each())
						if ( rec.list.remove(handlerAddr) )
							return true;
					
					return false;
				}
		};

	}
}