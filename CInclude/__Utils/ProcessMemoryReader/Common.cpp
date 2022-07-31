#pragma once

namespace ProcessMemoryReader {

		class WinError {
			private:
				std::string _funcName      = "";
				bool        _hasError      = false;
				DWORD       _lastErrorCode = 0;

			public:
				static std::string lastErrorCodeToString(const DWORD ec) {
					std::string text = "";
					
					if ( ec != 0 ) {
						LPSTR pMessageBuffer = nullptr;
						DWORD size = FormatMessageA(
							FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS,
							NULL, 
							ec, 
							MAKELANGID(LANG_ENGLISH, SUBLANG_ENGLISH_US), 
							(LPTSTR)&pMessageBuffer, 
							0, 
							NULL
						);
					
						if ( pMessageBuffer ) {
							if ( size ) {
								std::string tmp((const char*)pMessageBuffer, size);
								text = tmp.c_str();
							}

							LocalFree(pMessageBuffer);
						}
					}

					return text;	
				}
				static std::string formatErrorString(const DWORD ec, const char* pFuncName) {
					std::string text = "";
					
					if ( pFuncName )
						text += std::string("") + "Func: " + pFuncName + " ";
					
					text += "Ec: #" + std::to_string(ec) + " ";
					text += "Et: " + lastErrorCodeToString(ec);
					
					return text;
				}
	
				template< class T >
				static auto checkBool(const char* pFuncName, const T boolData) {
					const auto ec = GetLastError();

					if ( boolData )
						return WinError{ pFuncName };
					
					return WinError{ pFuncName, true, ec };
				}
				
				WinError(const std::string& funcName = "", const bool hasError = false, const DWORD lastErrorCode = 0) : 
					_funcName(funcName), _hasError(hasError), _lastErrorCode(lastErrorCode) {}

				bool fail() const { return _hasError; }

				std::string getErrorText() const {
					std::string text = "";
					
					if ( !fail() )
						return text;
					
					if ( _funcName.length() )
						text += "Func: " + _funcName + " ";
					
					text += "Ec: #" + std::to_string(_lastErrorCode) + " ";
					text += "Et: " + lastErrorCodeToString( _lastErrorCode );
					
					return text;
				}
		};

		class ErrorState {
			private:
				bool        _error = false;
				std::string _errorText = "";
			
			public:
				ErrorState() {}
				ErrorState(const std::string& text) : _error(true), _errorText(text) {}
				ErrorState(const WinError& e) {
					if ( e.fail() ) {
						_error = true;
						_errorText = e.getErrorText();
					}
				}

				auto fail() const { return _error; }
				auto getErrorText() const { return _errorText; }
		};
		
}