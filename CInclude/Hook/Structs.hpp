#pragma once

#include "Constants.hpp"

namespace ATF {
	namespace Hook {
		
		#pragma pack(push, 1)
		using TFuncInfo = Reflect::TFuncInfo;

		class TNameList  : public std::vector< std::string > {
			public:
				std::string buildName() const {
					std::string s = "";
					for(auto c : (*this))
						s += (s.length() ? "/" : "") + c;
					return s;
				}
		};
		struct TInformRecord {
			EnumHookMode  eHookMode   = EnumHookMode::Attach;
			uint64_t      handlerAddr = 0;
			
			TNameList     nameList;
			
			TFuncInfo     funcInfo;
			EnumHookState eHookState  = EnumHookState::ErrorInternal;
			
			EnumHookType  eHookType   = EnumHookType::Hook;
		};

		struct THookRequestRecord {
			uint64_t origAddr   = 0;
			uint64_t gateAddr   = 0;
		};
		struct THookResultRecord {
			bool     valid      = false;
			uint64_t origAddr   = 0;
			uint64_t gateAddr   = 0;
			uint64_t detourAddr = 0;
		};

		using TFunSetHook = THookResultRecord (*)(const THookRequestRecord& hookReq);
		using TFunInform  = void (*)(const TInformRecord& inform);
		#pragma pack(pop)

		struct TAttachInfo {
			bool         valid = false;
			EnumHookType eHookType;
			uint64_t     handlerAddr;
			TFuncInfo    funcInfo;
			TNameList    nameParts;

			std::string buildName() const {
				std::string s = "";
				for(auto c : nameParts)
					s += (s.length() ? "/" : "") + c;
				return s;
			}
		};

	}
}
