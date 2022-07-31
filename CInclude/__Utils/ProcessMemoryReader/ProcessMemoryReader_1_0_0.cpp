#pragma once

#include "Common.cpp"
#include "TCPMessageServer.cpp"

namespace ProcessMemoryReader {
	namespace Ver_1_0_0 {
	
		struct TAddressAccumulate {
			enum Mode {
				Abs,
				AbsModule,
				RelAdd,
				RelSub,
				DeRef,
			};
			struct TEntry {
				Mode     eMode = Abs;
				uint64_t value = 0;
			};
			
			void abs(const uint64_t value, Mode eMode = Abs) {
				_list.clear();
				_list.push_back({ eMode, value, });
			}
			void absModule(const uint64_t value) { abs(value, AbsModule); }
			void relAdd(const uint64_t value) { _list.push_back({ RelAdd, value, }); }
			void relSub(const uint64_t value) { _list.push_back({ RelSub, value, }); }
			void deRef() { _list.push_back({ DeRef, 0, }); }

			template< class TFunDeRef >
			uint64_t calcAddress(const uint64_t moduleBaseAddress, const TFunDeRef fDeRef) const {
				uint64_t address = 0;
				
				for(const auto& e : _list) {
					switch( e.eMode ) {
						case Abs      : address = e.value; break;
						case AbsModule: address = moduleBaseAddress + e.value; break;
						case RelAdd   : address += e.value; break;
						case RelSub   : address -= e.value; break;
						case DeRef    : {
							const auto rec = fDeRef(address);
							if ( !rec.first )
								return 0;
							
							address = rec.second;
						}
						break;
					}
				}
				
				return address;
			}
			
			std::string getInfoText() const {
				return getInfoText( static_cast<int32_t>(_list.size()) - 1 );
			}
				
			TAddressAccumulate() {}
			TAddressAccumulate(const uint64_t val) { abs(val); }

			private:
				std::vector< TEntry > _list;
				
				std::string getInfoText(const int32_t i) const {
					using namespace ATF::Reflect;
					
					if ( !( ( 0 <= i ) && ( i < _list.size() ) ) )
						return "";

					const std::string childInfo = getInfoText(i - 1);
					
					const auto& e = _list[i];
					auto valHex = stringFormat("0x", (void*)e.value);
					switch( e.eMode ) {	
						case AbsModule:
							valHex = "ModuleBase + " + valHex;
						
						case Abs: 
							return childInfo.length() ? stringFormat("(", childInfo, ", ", valHex, ")") : valHex;
						
						case RelAdd: return childInfo + " + " + valHex;
						case RelSub: return childInfo + " - " + valHex;
						case DeRef : return "[" + childInfo + "]";
						default:
							break;
					}
					
					return "{InvalidMode}";
				}
				
		};
		struct TNodeAccumulate {
			using Node = ATF::Reflect::Node;

			void push(Node n) { _list.push_back(n); }
			Node back() const { return _list.size() ? _list.back() : Node{}; }

			private:
				std::vector< Node > _list;
		};
		struct TState {
			using EnumNodeType = ATF::Reflect::EnumNodeType;
			
			enum EnumBlockType {
				LValue,
				Address,
				Type,
			};	
				
			bool               valid = false;
			EnumBlockType      eType = LValue;
			TNodeAccumulate    nodeAcc;
			TAddressAccumulate addrAcc;
				
			template< class TList, class T >
			static bool someOrTrueIfEmptyList(const TList& list, const T& val) {
				for(const auto e : list)
					if ( val == e )
						return true;
					
				return list.size() ? false : true;
			}
			bool check(const std::vector< EnumBlockType >& eTypeList = {}, const std::vector< EnumNodeType >& eNodeTypeList = {}) const {
				if ( !valid || !nodeAcc.back().valid )
					return false;
					
				if ( !someOrTrueIfEmptyList(eTypeList, eType) )
					return false;
					
				if ( !someOrTrueIfEmptyList(eNodeTypeList, nodeAcc.back().eNodeType) )
					return false;
				
				return true;
			}

			std::string getInfoText(const ATF::Reflect::StructNodeExtends& nodeEx = {}) const {
				using namespace ATF::Reflect;

				return 
					"Type: " + dumpStructType( nodeAcc.back(), nodeEx ) + "\n" +
					"Address: " + addrAcc.getInfoText();
			}

		};
		struct TStateStack {
			void push(TState s) { _list.push_back(s); }
			TState pop() {
				if ( !_list.size() )
					return TState{};
							
				auto ret = _list.back();
				_list.pop_back();
				return ret;
			}
						
			private:
				std::vector< TState > _list;
		};
		
		/// ###############################################
		class Lexer {
			public:
			
				static bool inRng(char min, char c, char max) { return (min <= c) && (c <= max); }
				static bool inArr(char c, const char* pPattern) {
					for(; *pPattern; pPattern++)
						if ( *pPattern == c )
							return true;
					return false;
				}
				static bool isNumChar(char c, bool next = false) { return inRng('0', c, '9') || ( next && (inRng('a', c, 'f') || inRng('A', c, 'F') || inArr(c, "xX") ) ); }
				static bool isWordChar(char c, bool next = false) { return inRng('a', c, 'z') || inRng('A', c, 'Z') || inArr(c, "_$") || ( next && inRng('0', c, '9') ); }
				static bool isSymbol(char c) { return inArr(c, "()[]<>*."); }
				static bool isSpace(char c) { return inArr(c, "\r\n\x09\x20"); }

				static bool isWordToken(const std::string& tok) {
					for(size_t i = 0; i != tok.length(); i++)
						if ( !isWordChar(tok[i], i) )
							return false;
					return tok.length() ? true : false;
				}
				static bool isNumToken(const std::string& tok) {
					for(size_t i = 0; i != tok.length(); i++)
						if ( !isNumChar(tok[i], i) )
							return false;
					return tok.length() ? true : false;
				}

				static constexpr const char* symbols[] = {
					"::", "->",
					"(", ")", "[", "]", "<", ">",
					"*", ".", "&",
				};
				
				static const char* findSymbol(const char* pCur) {
					for(auto pSym : symbols)
						if ( strstr(pCur, pSym) == pCur )
							return pSym;
					return nullptr;
				};

				using TTokenList = std::vector< std::string >;
				static auto getTokens(const std::string& code) {
					ATF::Reflect::ErrorList errorList;

					TTokenList tokens;
					std::string word = "";
					std::string num = "";
					
					auto wrls = [&](std::string& s) {
						if ( s.length() ) {
							tokens.push_back(s);
							s = "";
							return true;
						}
						return false;
					};
					
					const char* pCur = code.c_str();
					for(; *pCur; ) {
						while( isWordChar(*pCur, word.length()) ) {
							word.push_back(*pCur);
							pCur++;
						}
						if ( wrls(word) ) continue;

						while( isNumChar(*pCur, num.length()) ) {
							num.push_back(*pCur);
							pCur++;
						}
						if ( wrls(num) ) continue;

						auto pSym = findSymbol(pCur);
						if ( pSym ) {
							tokens.push_back( std::string("") + pSym );
							pCur += strlen(pSym);
							continue;
						}
						
						if ( isSpace(*pCur) ) {
							pCur++;
							continue;
						}

						errorList.errorAdd("Unxpected char '", *pCur, "'");
						break;
					}
					
					return std::make_pair(errorList, tokens);
				}

		};
		class Parser {
			public:
			
				enum Op {
					GlobalIdent,
					GetRef,
					FetchMember,
					FetchMemberDeRef,
					FetchArray,
					Var,
					TypePointer,
					Decltype,
					ReinterpretCast,
					DeRef,
					ConstNumber,
				};
				static std::string opToString(const Op op) {
					switch( op ) {
						case Op::GlobalIdent: return "GlobalIdent";
						case Op::GetRef: return "GetRef";
						case Op::FetchMember: return "FetchMember";
						case Op::FetchMemberDeRef: return "FetchMemberDeRef";
						case Op::FetchArray: return "FetchArray";
						case Op::Var: return "Var";
						case Op::TypePointer: return "TypePointer";
						case Op::Decltype: return "Decltype";
						case Op::ReinterpretCast: return "ReinterpretCast";
						case Op::DeRef: return "DeRef";
						case Op::ConstNumber: return "ConstNumber";
					}
					return "*InvalidOp*";
				};
			
				struct TCmd {
					Op op;
					std::string arg = "";
				};
				using TCmdList = std::vector< TCmd >;
				
				static auto parse(const Lexer::TTokenList& tokens) {
					ATF::Reflect::ErrorList errorList;
				
					size_t ti = 0;
					const auto gt = [&]() { return ti < tokens.size() ? tokens[ti] : std::string(""); };
					const auto ht = [&]() { return gt().length(); };
					const auto nt = [&]() { auto t = gt(); ti++; return t; };
					const auto at = [&](const std::string& exp) {
						if ( gt() != exp ) {
							errorList.errorAdd("Expected token '", exp, "', got '", gt(), "'");
							ti = 999999999;
						}
						nt();
						return exp;		
					};
					const auto it = [&](const std::string& t) {
						if ( gt() == t ) {
							nt();
							return true;
						}
						return false;
					};

					const auto readIdent = [&]() -> std::string {
						std::string ident = "";
						while( true ) {
							if ( !Lexer::isWordToken(gt()) ) {
								errorList.errorAdd("Expected word token, got '", gt(), "'");
								ti = 999999999;
								return "";
							}
							
							ident += nt();
							if ( gt() == "::" ) {
								ident += nt();
								continue;
							}
							break;
						}
						return ident;
					};
				
					TCmdList cmds;
					
					std::function< void() > readExpr;
					readExpr = [&]() {
						while( true ) {
							if ( it("&") ) {
								readExpr();
								cmds.push_back({ Op::GetRef });
								continue;
							}

							if ( it("*") ) {
								readExpr();
								cmds.push_back({ Op::DeRef });
								continue;
							}
							
							break;
						}
						
						while( true ) {
							if ( it("(") ) {
								readExpr();
								at(")");
								if ( gt() != "" )
									readExpr();
								continue;
							}
						
							if ( it("reinterpret_cast") ) {
								at("<");
								readExpr();
								at(">");
								
								at("(");
								readExpr();
								at(")");
								cmds.push_back({ Op::ReinterpretCast });
							
								continue;
							}
						
							if ( it("decltype") ) {
								at("(");
								readExpr();
								at(")");
								cmds.push_back({ Op::Decltype });
								continue;
							}
							
							if ( Lexer::isWordToken(gt()) ) {
								cmds.push_back({ Op::GlobalIdent, readIdent() });
								continue;
							}
							
							if ( Lexer::isNumToken(gt()) ) {
								cmds.push_back({ Op::ConstNumber, nt() });
								continue;
							}

							if ( it(".") ) {
								cmds.push_back({ Op::FetchMember, readIdent() });
								continue;
							}
							
							if ( it("->") ) {
								cmds.push_back({ Op::FetchMemberDeRef, readIdent() });
								continue;
							}
							
							if ( it("[") ) {
								cmds.push_back({ Op::FetchArray, nt() });
								at("]");
								continue;
							}
							
							if ( it("*") ) {
								cmds.push_back({ Op::TypePointer, });
								continue;
							}
						
							break;
						}
					};
				
					readExpr();
				
					if ( gt() != "" )
						errorList.errorAdd("Unxpected token '", gt(), "'");
					
					return std::make_pair(errorList, cmds);
				}
				
				static std::string dumpCmdList(const TCmdList& cmdList) {
					std::string text = "";
					for(const auto& cmd : cmdList)
						text += "  " + opToString(cmd.op) + ": '" + cmd.arg + "'\n";
					return text;
				}

		};
		class Builder : public ATF::Reflect::ErrorList {
			private:
				ATF::Reflect::ErrorList errorList;

				ATF::Reflect::StructNodeExtends _nodeEx;

				ATF::Reflect::Node _getNode(const int32_t nodeID) {
					const auto node = _nodeEx.getNode(nodeID);
					if ( !node.valid )
						errorAdd("Node #", nodeID, " not found");
					return node;
				}

				TState _state;

			public:
			
				static const auto& getNodeNameMap() {
					static std::mutex _mutex;
					std::lock_guard< std::mutex > lg(_mutex);
					
					static std::unordered_map< std::string, ATF::Reflect::Node > nodeNameMap;
					if ( nodeNameMap.size() )
						return nodeNameMap;
					
					ATF::Reflect::eachStructNode([&](auto node) {
						if ( strlen(node.name) )
							nodeNameMap[ node.name ] = node;
					});
					
					return nodeNameMap;
				}
				
				static auto strToU64(const std::string& str) {
					std::stringstream sst;
					if ( str.length() >= 2 && str[0] == '0' && Lexer::inArr(str[1], "xX") ) {
						sst << std::hex << str;
					} else {
						sst << str;
					}
					
					uint64_t value = 0;
					sst >> value;
					return std::make_pair( sst.fail(), value );
				}
				static auto findDataMemberField(const ATF::Reflect::Node& node, const char* pFieldName) {
					ATF::Reflect::Node ret;
					eachStructField(node, [&](const auto& fieldNode) {
						if ( !strcmp(fieldNode.name, pFieldName) )
							ret = fieldNode;
					});
					return ret;
				}

				Builder(const Parser::TCmdList& cmds) {
					using namespace ATF::Reflect;
					
					using Op = Parser::Op;

					const auto& nodeNameMap = getNodeNameMap();
					
					TStateStack stateStack;
					for(auto c : cmds) {
						switch( c.op ) {
							case Op::GlobalIdent: {
								const auto rec = nodeNameMap.find(c.arg);
								if ( rec == nodeNameMap.end() ) {
									errorAdd("Global ident '"+c.arg+"' not found.");
									break;
								}
								
								const auto node = rec->second;
								
								TState state = { true, TState::Type };
								state.nodeAcc.push( node );
								
								if ( node.eNodeType == EnumNodeType::TypeVar || node.eNodeType == EnumNodeType::TypeStaticDataMemberField ) {
									const auto nextNode = _getNode( node.typeVar.elementTypeID );
									state.nodeAcc.push( nextNode );
									state.addrAcc.absModule( node.typeVar.address - ATF::Reflect::BaseAddressExpected );
									state.eType = TState::LValue;
									if ( !nextNode.valid ) {
										errorAdd("Global ident '"+c.arg+"' invalid type.");
										break;
									}
								}
								
								stateStack.push(state);
							}
							break;
							
							case Op::FetchArray: {
								auto state = stateStack.pop();
								
								const auto recIndex = strToU64(c.arg);
								if ( recIndex.first ) {
									errorAdd("Invalid uint number '"+c.arg+"'.");
									break;
								}
								const uint64_t index = recIndex.second;
								
								if ( state.check({ TState::Type }) ) {
									const auto newNode = _nodeEx.createNodeArray( state.nodeAcc.back(), index );
									state.nodeAcc.push( newNode );
									stateStack.push( state );
									break;
								}
								
								if ( !state.check({ TState::LValue, TState::Address }) ) {
									errorAdd("Invalid fetch array, invalid l-value ["+c.arg+"].");
									break;
								}
								
								switch( state.nodeAcc.back().eNodeType ) {
									case EnumNodeType::TypeArray: {
										const auto nodeItem = _getNode( state.nodeAcc.back().typeArray.elementTypeID );
										const uint64_t arrCount = state.nodeAcc.back().size / nodeItem.size;
										if ( index >= arrCount ) {
											errorAdd("Invalid fetch array, invalid index ["+c.arg+"], have array count "+std::to_string(arrCount)+".");
											break;
										}
										
										state.addrAcc.relAdd( nodeItem.size * index );
										state.nodeAcc.push( nodeItem );
										stateStack.push( state );
									}
									break;
										
									case EnumNodeType::TypePointer: {
										const auto nodeItem = _getNode( state.nodeAcc.back().typeArray.elementTypeID );
										
										if ( state.check({ TState::LValue }) )
											state.addrAcc.deRef();
										state.addrAcc.relAdd( nodeItem.size * index );
										state.nodeAcc.push( nodeItem );
										stateStack.push( state );
									}
									break;
									
									default:
										errorAdd("Invalid fetch array, invalid l-value type ["+c.arg+"].");
										break;
								}
							}
							break;
							
							case Op::FetchMemberDeRef: {
								auto state = stateStack.pop();
								if ( !state.check({ TState::LValue, TState::Address }, { EnumNodeType::TypePointer }) ) {
									errorAdd("Invalid fetch member, invalid l-value/address '->"+c.arg+"'.");
									break;
								}
								
								const auto nextNode = _getNode( state.nodeAcc.back().typePointer.elementTypeID );
								state.nodeAcc.push( nextNode );
								if ( state.check({ TState::LValue }) )
									state.addrAcc.deRef();
								state.eType = TState::LValue;
								stateStack.push(state);
							}
							case Op::FetchMember: {
								auto state = stateStack.pop();
								if ( !state.check({ TState::LValue }) ) {
									errorAdd("Invalid fetch member, invalid l-value 2 '."+c.arg+"'.");
									break;
								}
								
								switch( state.nodeAcc.back().eNodeType ) {
									case EnumNodeType::TypeStruct:
									case EnumNodeType::TypeClass:
									case EnumNodeType::TypeUnion: {
										const auto fieldNode = findDataMemberField(state.nodeAcc.back(), c.arg.c_str());
										if ( !fieldNode.valid ) {
											errorAdd("Invalid fetch member, '."+c.arg+"' member not found.");
											break;
										}
										
										const auto finalNode = _getNode(fieldNode.typeDataMemberField.elementTypeID);
										
										state.addrAcc.relAdd( fieldNode.typeDataMemberField.offset );
										state.nodeAcc.push( finalNode );
										stateStack.push( state );
									}
									break;
									
									default:
										errorAdd("Invalid fetch member, invalid l-value 1 '."+c.arg+"'.");
										break;
								}
							}
							break;
							
							case Op::GetRef: {
								auto state = stateStack.pop();
								if ( !state.check({ TState::LValue }) ) {
									errorAdd("Invalid get reference, invalid l-value.");
									break;
								}
								
								const auto newNode = _nodeEx.createNodePointer( state.nodeAcc.back() );
								state.nodeAcc.push( newNode );
								state.eType = TState::Address;
								stateStack.push( state );
							}
							break;
							
							case Op::DeRef: {
								auto state = stateStack.pop();
								if ( !state.check({ TState::LValue, TState::Address }, { EnumNodeType::TypePointer }) ) {
									errorAdd("Invalid dereference, invalid l-value/address.");
									break;
								}
								
								const auto nextNode = _getNode( state.nodeAcc.back().typePointer.elementTypeID );
								state.nodeAcc.push( nextNode );
								if ( state.check({ TState::LValue }) )
									state.addrAcc.deRef();
								state.eType = TState::LValue;
								stateStack.push(state);
							}
							break;
							
							case Op::TypePointer: {
								auto state = stateStack.pop();
								if ( !state.check({ TState::Type }) ) {
									errorAdd("Invalid type pointer, invalid type expr.");
									break;
								}
								
								const auto newNode = _nodeEx.createNodePointer( state.nodeAcc.back() );
								state.nodeAcc.push( newNode );
								stateStack.push( state );
							}
							break;
							
							case Op::ReinterpretCast: {
								auto stateR = stateStack.pop();
								auto stateL = stateStack.pop();
								
								bool rInvalid = false;
								if ( !stateR.valid ) rInvalid = true;
								if ( !( stateR.eType == TState::LValue || stateR.eType == TState::Address ) ) rInvalid = true;
								if ( !( !stateR.nodeAcc.back().valid || stateR.nodeAcc.back().eNodeType == EnumNodeType::TypePointer ) ) rInvalid = true;
								if ( rInvalid ) {
									errorAdd("Invalid reinterpret_cast, invalid cast from expr.");
									break;
								}
								
								if ( !stateL.check({ TState::Type }, { EnumNodeType::TypePointer }) ) {
									errorAdd("Invalid reinterpret_cast, invalid cast to type.");
									break;
								}
								
								stateR.nodeAcc.push( stateL.nodeAcc.back() );
								stateStack.push(stateR);
							};
							break;
							
							case Op::Decltype: {
								auto state = stateStack.pop();
								if ( !state.check({ TState::LValue, TState::Address }) ) {
									errorAdd("Invalid decltype, invalid l-value/address expr.");
									break;
								}
								
								state.eType = TState::Type;
								stateStack.push( state );
							};
							break;
							
							case Op::ConstNumber: {
								const auto recIndex = strToU64(c.arg);
								if ( recIndex.first ) {
									errorAdd("Invalid uint const number '"+c.arg+"'.");
									break;
								}
								const uint64_t num = recIndex.second;
								
								TState state = { true, TState::Address };
								state.addrAcc.abs( num );
								stateStack.push( state );
							}
							break;
							
							default:
								errorAdd("Internal error, unxepectd op #" + std::to_string((int)c.op));
						}
					}
					
					const auto state = stateStack.pop();
					if ( !state.valid )
						errorAdd("Invalid expr.");
					
					if ( stateStack.pop().valid )
						errorAdd("Invalid expr.");
					
					if ( !state.check({ TState::LValue, TState::Address }) )
						errorAdd("Invalid expr(final is type, expected l-value/address).");
					
					_state = state;
				}

				auto getNodeEx() const { return _nodeEx; }
				auto getState() const { return _state; }
		};


		/// ###############################################
		class WinHandle : public WinError {
			private:
				HANDLE const _hValue = INVALID_HANDLE_VALUE;

			public:
				static bool isValidHandle(HANDLE h) { return (h != NULL) && (h != INVALID_HANDLE_VALUE); }
				
				WinHandle(const std::string& funcName, const HANDLE hValue, const DWORD ec) : 
					WinError(funcName, !isValidHandle(hValue) || ( ec != 0 ), ec), 
					_hValue(hValue) {}

				HANDLE getHandle() const { return _hValue; }
				
				~WinHandle() {
					if ( isValidHandle(_hValue) ) {
						::CloseHandle(_hValue);
					}
				}
		};
		using SP_WinHandle = std::shared_ptr< WinHandle >;
		SP_WinHandle CreateWinHandle(const char* pFuncName, const HANDLE hValue) {
			const DWORD lastErrorCode = WinHandle::isValidHandle(hValue) ? 0 : ::GetLastError();
			
			return std::make_shared< WinHandle >( std::string(pFuncName), hValue, lastErrorCode );
		}

		auto win_FindOnceProcessIdByProcessName(const std::string& processName) {
			std::vector< DWORD > candsProcesIdList;
					
			PROCESSENTRY32 entry = {0};
			entry.dwSize = sizeof(PROCESSENTRY32);

			const auto snapshot = CreateWinHandle("CreateToolhelp32Snapshot", ::CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, NULL));
			if ( snapshot->fail() )
				return std::make_pair( snapshot->getErrorText(), (DWORD)0 );

			if ( ::Process32First(snapshot->getHandle(), &entry) )
				while( ::Process32Next(snapshot->getHandle(), &entry) )
					if ( !strcmp(entry.szExeFile, processName.c_str()) )
						candsProcesIdList.push_back(entry.th32ProcessID);

			if ( candsProcesIdList.size() == 0 )
				return std::make_pair( ATF::Reflect::stringFormat("Process '", processName, "' not found"), (DWORD)0 );
					
			if ( candsProcesIdList.size() != 1 )
				return std::make_pair( ATF::Reflect::stringFormat("Process '", processName, "' found more 1(",candsProcesIdList.size(),")"), (DWORD)0 );

			return std::make_pair( std::string(""), candsProcesIdList[0] );
		}

		class WinReadProcessMemory {
			private:
				std::string  _errorText = "";
				SP_WinHandle _process   = nullptr;
				
			public:
				WinReadProcessMemory(const std::string& processName) {
					const auto prcRec = win_FindOnceProcessIdByProcessName(processName);
					_errorText = prcRec.first;
					if ( _errorText.length() ) 
						return;

					auto newProcess = CreateWinHandle("OpenProcess", OpenProcess(PROCESS_VM_READ, FALSE, prcRec.second));
					if ( newProcess->fail() ) {
						_errorText = newProcess->getErrorText();
						return;
					}

					_process = newProcess;
				}

				auto getErrorText() const { return _errorText; }

				auto readMemory(const uint64_t address, const uint64_t size) const {
					auto mem = std::make_shared< std::vector< uint8_t > >();
					mem->resize(size);
					
					auto retFalse = [&](auto err) {
						return std::make_pair( ATF::Reflect::stringFormat( "[",(void*)address, "(",size,")] ", err ), mem );
					};
					
					if ( !_process )
						return retFalse("No init");
					
					SIZE_T numberOfBytesRead = 0;
					const auto rmStatus = WinError::checkBool("ReadProcessMemory", 
						::ReadProcessMemory( _process->getHandle(), (LPCVOID)address, (LPVOID)&((*mem)[0]), (SIZE_T)mem->size(), (SIZE_T*)&numberOfBytesRead ) );
					
					if ( rmStatus.fail() )
						return retFalse( rmStatus.getErrorText() );
					
					if ( mem->size() != numberOfBytesRead )
						return retFalse("Only part of a ReadProcessMemory or WriteProcessMemory request was completed");
					
					return std::make_pair( std::string(""), mem );
				}
		};
		using SP_WinReadProcessMemory = std::shared_ptr< WinReadProcessMemory >;

		std::string processStruct(std::string& outValue, const std::string& code, SP_WinReadProcessMemory wrpm, const uint64_t baseAddress, const bool dumpJson = false) {
			const auto tokRec = Lexer::getTokens(code);
			if ( tokRec.first.errorHas() )
				return tokRec.first.errorGetFirst();

			const auto cmdRec = Parser::parse(tokRec.second);
			if ( cmdRec.first.errorHas() )
				return cmdRec.first.errorGetFirst();
			
			Builder builder(cmdRec.second);
			if ( builder.errorHas() )
				return builder.errorGetFirst();
			
			const auto state = builder.getState();
			if ( !state.check({ TState::LValue, TState::Address }) )
				return "Invalid type state, expected l-value/address";
			
			std::string errorText = "";
			const uint64_t address = state.addrAcc.calcAddress( baseAddress, [&](const uint64_t address) {
				uint64_t nextAddress = 0;
				
				auto memRec = wrpm->readMemory(address, 8);
				errorText = memRec.first;
				if ( errorText.length() )
					return std::make_pair( false, nextAddress );
				
				nextAddress = *( (uint64_t*)&(*memRec.second)[0] );
				
				return std::make_pair( true, nextAddress );
			});
			
			if ( errorText.length() )
				return errorText;

			if ( state.eType == TState::Address ) {
				outValue = ATF::Reflect::StructDumper::ptrToHex(address, dumpJson);
			}
			
			if ( state.eType == TState::LValue ) {
				auto memRec = wrpm->readMemory(address, state.nodeAcc.back().size);
				if ( memRec.first.length() )
					return memRec.first;
				
				auto dumpRec = ATF::Reflect::dumpStruct(state.nodeAcc.back(), &(*memRec.second)[0], { dumpJson, 1, }, builder.getNodeEx());
				if ( dumpRec.first.errorHas() )
					return dumpRec.first.errorGetFirst();
				
				outValue = dumpRec.second;
			}

			return "";
		}

		
		void apiWorker(TCPMessageServer::SP_TCPMessageServer tms, SP_WinReadProcessMemory wrpm, const uint64_t baseAddress) {
			#pragma pack(push, 1)
			struct TReadMemoryReq {
				uint32_t cmdID;
				uint32_t rpcID;
			};
			#pragma pack(pop)
			
			const uint32_t CmdReqReadMemory = 1;
			const uint32_t CmdResReadMemory = 2;
			
			while( true ) {
				auto msgRec = tms->readMessage();
				if ( msgRec.first ) {
					auto msg = msgRec.second;
					if ( msg.messageData ) {
						if ( sizeof(TReadMemoryReq) + 1 <= msg.messageData->size() ) {
							auto dataRec = msg.messageData->getData();
							const uint8_t* pData    = dataRec.first;
							const uint64_t dataSize = dataRec.second;
							const auto pHead = reinterpret_cast< const TReadMemoryReq* >(pData);
							
							if ( pHead->cmdID == CmdReqReadMemory ) {
								std::string code_s((const char*)&pHead[1], dataSize - sizeof(TReadMemoryReq));
								std::string code = code_s.c_str();
								{
									std::string out = "";
									const auto error = processStruct(out, code, wrpm, baseAddress, true);
									if ( error.length() )
										out = "#" + error;
									
									auto msgRes = std::make_shared< TCPMessageServer::MessageData >();
									msgRes->append( TReadMemoryReq{ CmdResReadMemory, pHead->rpcID } );
									msgRes->append( (const uint8_t*)out.c_str(), out.length() + 1 );
									tms->sendMessage( msg.clientID, msgRes );
								}
								continue;
							}
						}
					}
				}
				
				Sleep(1);
			}
		}

		template< class T >
		void main(const T& conOptList) {
			const auto processName = conOptList.get("target");
			const bool dumpJson = conOptList.has("dumpJson");
					
			uint64_t baseAddress = 0x140000000;
			if ( conOptList.has("baseAddress") ) {
				const auto rec = Builder::strToU64( conOptList.get("baseAddress") );
				if ( rec.first ) {
					std::cout << "Invalid baseAddress \n";
					return;
				}
						
				baseAddress = rec.second;
			}
					
			if ( !processName.length() ) {
				std::cout << "Target process is not set\n";
				return;
			}

			auto wrpm = std::make_shared< WinReadProcessMemory >( processName );
			if ( wrpm->getErrorText().length() ) {
				std::cout << wrpm->getErrorText() << "\n";
				return;
			}
			
			if ( conOptList.has("api-host") ) {
				const auto host = conOptList.get("api-host");
				const auto portStr = conOptList.get("api-port");
				if ( !portStr.length() ) {
					std::cout << "api-port not found\n";
					return;
				}
				
				const auto rec = Builder::strToU64( portStr );
				const auto portU64 = rec.second;
				if ( rec.first || ( portU64 > 0xFFFF ) ) {
					std::cout << "Invalid api-port \n";
					return;
				}
				
				const auto numWorkersRec = Builder::strToU64( conOptList.get("num-workers", "4") );
				const auto numWorkersU64 = numWorkersRec.second;
				if ( numWorkersRec.first || !numWorkersU64 || ( numWorkersU64 > 32 ) ) {
					std::cout << "Invalid num-workers ( must on [1;32] )\n";
					return;
				}
				
				auto tmsRec = TCPMessageServer::CreateTCPMessageServer(host, (uint16_t)portU64);
				auto tms = tmsRec.second;
				if ( !tms ) {
					std::cout << "Bind api server error: " << tmsRec.first.getErrorText() << "\n";
					return;
				}
				
				for(size_t i = 0; i != numWorkersU64; i++)
					std::thread(apiWorker, tms, wrpm, baseAddress).detach();
			}

			while( true ) {
				std::string line;
				std::getline( std::cin, line );
						
				std::string out = "";
				const auto error = processStruct(out, line, wrpm, baseAddress, dumpJson);
				if ( error.length() )
					std::cout << "#" << error << "\n";
				else
					std::cout << out << "\n";
			}
		}


	}
}