#include <iostream>
#include <cassert>

#include <atomic>
#include <mutex>
#include <vector>
#include <array>

#include <map>
#include <unordered_map>
#include <string>
#include <sstream>

#include <windows.h>
#include <tlhelp32.h>

#define ATF_COMPILE_WITH_CHECK_ALL
#define ATF_COMPILE_WITH_REFLECT_STRUCT_INFO
#include "../../Include.hpp"

#include "ProcessMemoryReader_1_0_0.cpp"

class TConOptionList {
	private:
		std::unordered_map< std::string, std::string > _map;
	
	public:
		void fromConArgs(const int argc, const char** argv) {
			for(int i = 0; i < argc; i++) {
				const char* pArg = argv[i];
				if ( !pArg )
					continue;
				
				const auto argLen = strlen(pArg);
				if ( argLen <= 1 )
					continue;
				
				if ( pArg[0] != '-' )
					continue;
				
				pArg++;
				
				std::string key = "";
				std::string value = "";
				for(; *pArg; pArg++) {
					if ( *pArg == ':' ) {
						pArg++;
						break;
					}
					
					key += *pArg;
				}
				
				if ( *pArg )
					value = pArg;
				
				_map[ key ] = value;
			}
		}

		bool        has(const std::string& key) const { return _map.find(key) != _map.end(); }
		std::string get(const std::string& key, const std::string& def = "") const { 
			const auto rec = _map.find(key);
			if ( rec == _map.end() )
				return def;
			return rec->second;
		}
};

int main(const int argc, const char **argv) {
	using namespace ProcessMemoryReader;
	using namespace ProcessMemoryReader::Ver_1_0_0;
	
	ATF::CheckAll::checkAll();

	TConOptionList col;
	col.fromConArgs(argc, argv);

	const auto ver = col.get("version", "1.0.0");

	if ( ver == "1.0.0" ) {
		ProcessMemoryReader::Ver_1_0_0::main(col);
		return 0;
	}

	std::cout << "Version " << ver << " not found\n";

	return 0;
}
