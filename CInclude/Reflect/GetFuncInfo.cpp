#pragma once
 
namespace ATF {
	namespace __Local__ {

		#pragma pack(push, 1)
		struct TFuncInfo {
			bool        valid    = false;
			int32_t     internalID;
			bool        isStatic = false;
			bool        isMethod = false;
			uint64_t    address  = 0;
			const char* name     = "";
		};
		#pragma pack(pop)


		bool __getBit(const uint64_t* a64view, const int32_t internalID) {
			const size_t wordIndex = internalID / 64;
			const size_t bitIndex  = internalID % 64;
					
			return ( ( a64view[ wordIndex ] >> bitIndex ) & 1 ) ? true : false;
		}

		TFuncInfo getFuncInfo(const int32_t internalID) {
			if ( internalID < 0 )
				return TFuncInfo{ false, internalID };
					
			if ( internalID >= __Local__::__FuncCount )
				return TFuncInfo{ false, internalID };

			const char* pFuncName = "";
			
			#ifndef ATF_COMPILE_WITHOUT_REFLECT_FUNC_NAMES
				pFuncName = __Local__::__FuncNameList[internalID];
			#endif

			return TFuncInfo{
				true,
				internalID,
				__getBit(__Local__::__FuncIsStaticBitList, internalID),
				__getBit(__Local__::__FuncIsMethodBitList, internalID),
				__Local__::__FuncAddrList[internalID],
				pFuncName,
			};
		}
	}
	namespace Reflect {
		using TFuncInfo = __Local__::TFuncInfo;

		template< class TFun >
		void eachFuncInfo(TFun f) {
			for(int32_t i = 0; i < __Local__::__FuncCount; i++)
				f( __Local__::getFuncInfo(i) );
		}
	}
}