#pragma once

#include <cstdint>
#include <cassert>
#include <array>
#include <atomic>
#include <mutex>
#include <vector>

#include "windows.h"

#include "Types.hpp"
#include "Structs.cpp"
#include "Reflect/AG_Module.hpp"

#include "AG_Header.hpp"

#ifdef ATF_COMPILE_WITH_CHECK_ALL
	#include "AG_CheckAll.cpp"
#endif

#ifndef ATF_COMPILE_WITHOUT_SOURCE
	#include "AG_Source.cpp"
#endif

#ifndef ATF_COMPILE_WITHOUT_VARS
	#include "AG_Vars.cpp"
#endif

#ifndef ATF_COMPILE_WITHOUT_REFLECT
	#ifndef ATF_COMPILE_WITHOUT_REFLECT_FUNC_NAMES
		#include "Reflect/AG_FuncNameList.cpp"
	#endif

	#include "Reflect/AG_FuncInfoList.cpp"
	#include "Reflect/GetFuncInfo.cpp"

	#ifndef ATF_COMPILE_WITHOUT_REFLECT_FUNC_INFO
		#include "Reflect/AG_FuncInfo.cpp"
	#endif
	
	#ifdef ATF_COMPILE_WITH_REFLECT_STRUCT_INFO
		#include "Reflect/AG_StructInfoList.cpp"
		#include "Reflect/GetStructInfo.cpp"
		#include "Reflect/StructDumper.cpp"
		
		#ifndef ATF_COMPILE_WITHOUT_REFLECT_STRUCT_INFO
			#include "Reflect/AG_StructInfo.cpp"
		#endif
	#endif
#endif

#ifndef ATF_COMPILE_WITHOUT_HOOK
	#include "Hook/Base.cpp"
	#include "Hook/BaseEx.cpp"
	#include "Hook/AG_Hook.hpp"
	#include "Hook/EternalHookMgrViewAPI.cpp"

	#ifndef ATF_COMPILE_WITHOUT_HOOK_SORUCE
		#include "Hook/AG_Hook.cpp"
		#include "Hook/HookMgr.cpp"
	#endif
#endif

