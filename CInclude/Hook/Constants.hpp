#pragma once

namespace ATF {
	namespace Hook {
		
		using TVersion = __Local__::TVersion;

		const TVersion HookVersion{ 0, 1, 1, };

		enum class EnumHookState : int32_t {
			Done                       = 0,
			ErrorInternal              = 1,
			ErrorAlreadyExists         = 3,
			ErrorNotFound              = 4,
			ErrorInvalidHookAddr       = 5,
			ErrorAccess                = 6,
			ErrorDifferentATFSignature = 7,
			ErrorDifferentHookVersion  = 8, 
		};
		enum class EnumHookMode : int32_t {
			Attach    = 0,
			Detach    = 1,
			DetachAll = 2,
		};
		enum class EnumHookType : int32_t {
			Hook   = 0,
			ObsBfr = 1,
			ObsAfr = 2,
		};
		
		struct EnumHookAccessFlags {
			static constexpr int32_t AttachHook   = 1 << 0;
			static constexpr int32_t AttachObsBfr = 1 << 1;
			static constexpr int32_t AttachObsAfr = 1 << 2;
			
			static constexpr int32_t AllAccess    = AttachHook|AttachObsBfr|AttachObsAfr;
		};

		std::string enumHookStateToString(const EnumHookState e) {
			switch(e) {
				case EnumHookState::Done                      : return "Done";
				case EnumHookState::ErrorInternal             : return "ErrorInternal";
				case EnumHookState::ErrorAlreadyExists        : return "ErrorAlreadyExists";
				case EnumHookState::ErrorNotFound             : return "ErrorNotFound";
				case EnumHookState::ErrorInvalidHookAddr      : return "ErrorInvalidHookAddr";
				case EnumHookState::ErrorAccess               : return "ErrorAccess";
				case EnumHookState::ErrorDifferentATFSignature: return "ErrorDifferentATFSignature";
				case EnumHookState::ErrorDifferentHookVersion : return "ErrorDifferentHookVersion";
			}
			return "*InvaldEnumHookState*";
		}
		std::string enumHookModeToString(const EnumHookMode e) {
			switch(e) {
				case EnumHookMode::Attach   : return "Attach";
				case EnumHookMode::Detach   : return "Detach";
				case EnumHookMode::DetachAll: return "DetachAll";
			}
			return "*InvaldEnumHookMode*";
		}
		std::string enumHookTypeToString(const EnumHookType e) {
			switch(e) {
				case EnumHookType::Hook  : return "Hook";
				case EnumHookType::ObsBfr: return "ObserverBefore";
				case EnumHookType::ObsAfr: return "ObserverAfter";
			}
			return "*InvaldHookType*";
		}

	}
}