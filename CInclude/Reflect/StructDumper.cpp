#pragma once
 
namespace ATF {
	namespace Reflect {
	
		std::string stringFormat() { 
			return ""; 
		}
		template< class TArg, class... TArgs >
		std::string stringFormat(const TArg arg, const TArgs... args) {
			std::ostringstream oss;
			oss << arg;
			return oss.str() + stringFormat(args...);
		}

		class ErrorList {
			private:
				std::vector< std::string > _errorList;

			public:
				template< class... TArgs >
				void errorAdd(const TArgs... args) {
					_errorList.push_back( stringFormat(args...) );
				}
				
				auto        errorGetList () const { return _errorList; }
				bool        errorHas     () const { return _errorList.size(); }
				std::string errorGetFirst() const { return _errorList.size() ? _errorList[0] : ""; }
		};

		class StructNodeExtends {
			private:
				std::unordered_map< int32_t, Node > _fakeNodeIdMap;
					
				int32_t _nextFakeID = 1 << 30;
				int32_t _getNextFakeID() {
					return _nextFakeID++;
				}
				
				Node _addFakeNode(Node node) {
					if ( !node.valid )
						return ATF::Reflect::Node{};
					
					if ( node.id )
						return ATF::Reflect::Node{};
					
					node.id = _getNextFakeID();
					_fakeNodeIdMap[ node.id ] = node;
					
					return node;
				}

			public:
				Node getNode(const int32_t nodeID) const {
					const auto it = _fakeNodeIdMap.find(nodeID);
					if ( it != _fakeNodeIdMap.end() )
						return it->second;

					return ATF::Reflect::getStructNode(nodeID);
				}
				
				Node createNodePointer(const ATF::Reflect::Node& elementTypeNode) {
					Node n;
					n.eNodeType = EnumNodeType::TypePointer;
					n.size = 8;
					n.typePointer.elementTypeID = elementTypeNode.id;
					n.valid = true;
					n.name = "";
					n.id = 0;
					return _addFakeNode(n);
				}
				Node createNodeArray(const ATF::Reflect::Node& elementTypeNode, const uint64_t count) {
					Node n;
					n.eNodeType = EnumNodeType::TypeArray;
					n.size = count * elementTypeNode.size;
					n.typeArray.elementTypeID = elementTypeNode.id;
					n.valid = true;
					n.name = "";
					n.id = 0;
					return _addFakeNode(n);
				}
		};


		struct TStructDumperOptions {
			bool        dumpJson    = true;
			uint32_t    startGapLvl = 0;
			const char* gap         = "  ";
		};
		class StructDumper : public ErrorList {
			private:
				bool        dumpJson    = true;
				const char* gap         = "  ";
				size_t      startGapLvl = 0;
				
				StructNodeExtends _nodeEx;
				
				template< const bool OnlyInt > static auto __dynamicDefineType();
				template<> static auto __dynamicDefineType< true >() {
					return [](const auto nodeName, const auto fNext) {
						if ( nodeName == "int8_t"    ) fNext( (int8_t )0 );
						if ( nodeName == "int16_t"   ) fNext( (int16_t)0 );
						if ( nodeName == "int32_t"   ) fNext( (int32_t)0 );
						if ( nodeName == "int64_t"   ) fNext( (int64_t)0 );

						if ( nodeName == "uint8_t"   ) fNext( (uint8_t )0 );
						if ( nodeName == "uint16_t"  ) fNext( (uint16_t)0 );
						if ( nodeName == "uint32_t"  ) fNext( (uint32_t)0 );
						if ( nodeName == "uint64_t"  ) fNext( (uint64_t)0 );
					};
				}
				template<> static auto __dynamicDefineType< false >() {
					using float32_t = ATF::float32_t;
					using float64_t = ATF::float64_t;
					using uchar16_t = ATF::uchar16_t;
					
					return [](const auto nodeName, const auto fNext) {
						if ( nodeName == "bool"      ) fNext( (bool   )0 );

						if ( nodeName == "float32_t" ) fNext( (float32_t)0 );
						if ( nodeName == "float64_t" ) fNext( (float64_t)0 );

						if ( nodeName == "char"      ) fNext( (int8_t   )0 );
						if ( nodeName == "uchar16_t" ) fNext( (uchar16_t)0 );

						__dynamicDefineType< true >()(nodeName, fNext);
					};
				}
				
				template< const bool onlyInt, class TFun >
				static std::string dynamicDefineType(const ATF::Reflect::Node& node, const TFun fNext) {
					using namespace ATF::Reflect;

					if ( node.eNodeType != EnumNodeType::TypeScalar )
						return stringFormat("Expected TypeScalar, got #", (int)node.eNodeType);

					std::string error = stringFormat("Invalid TypeScalar(",node.name,")");
					
					__dynamicDefineType< onlyInt >()(std::string(node.name), [&](const auto varType) {
						if ( sizeof(varType) != node.size ) {
							error = stringFormat("Invalid TypeScalar(", node.name,") size, expected ", node.size, " got ", sizeof(varType));
							return;
						}

						fNext(varType);
						error = "";
					});
					
						
					return error;
				}
				
				static std::string jsonChar(const uint8_t c) {
					bool isEscape = false;
					if ( c <= 31  ) isEscape = true;
					if ( c == 34  ) isEscape = true;
					if ( c == 92  ) isEscape = true;
					if ( c >= 127 ) isEscape = true;
					if ( c >= 127 ) isEscape = true;
					
					std::string str = "";
					if ( isEscape ) {
						std::stringstream sst;
						sst << std::hex << ((uint32_t)c);
						sst >> str;
						while( str.length() < 4 )
							str = "0" + str;
						str = "\\u" + str;
						return str;
					}
					
					str += (char)c;
					
					return str;
				}
				static std::string jsonString(const std::string& in) {
					std::string out = "";
					for(const auto c : in)
						out += jsonChar(c);
					return out;
				}
				static std::string jsonQuotesCond(const std::string& in, const bool fl) {
					return fl ? ( "\"" + in + "\"" ) : in;
				}
				static std::string jsonCorrectScalarValueCond(const std::string& in, const ATF::Reflect::Node& node, const bool fl) {
					bool withoutCorrect = false;
					auto add = [&](auto wc) {
						if ( wc )
							withoutCorrect = true;
					};
						
					add(!fl);
					add(!strcmp(node.name, "int32_t"  ));
					add(!strcmp(node.name, "float32_t"));
					add(!strcmp(node.name, "float64_t"));
					add(node.size < 4);
					
					return jsonQuotesCond(in, !withoutCorrect);
				}


				Node _getNode(const int32_t nodeID) {
					const auto node = _nodeEx.getNode(nodeID);
					if ( !node.valid )
						errorAdd("Node #", nodeID, " not found");
					
					return node;
				}
			public:
				StructDumper(const TStructDumperOptions& dumperOptions = {}, const StructNodeExtends& nodeEx = {}) : _nodeEx(nodeEx) {
					dumpJson    = dumperOptions.dumpJson;
					startGapLvl = dumperOptions.startGapLvl;
					if ( dumperOptions.gap )
						gap = dumperOptions.gap;
				}
				
				std::string dumpStruct(const ATF::Reflect::Node& node, const uint8_t* pData, size_t gapLv = 0) {
					using namespace ATF::Reflect;
					
					if ( gapLv == 0 )
						gapLv = startGapLvl;
					
					std::string GAP_PREV = "";
					std::string GAP = "";
					for(size_t i = 0; i != gapLv; i++) {
						GAP += gap;
						if ( i != 0 )
							GAP_PREV += gap;
					}
					
					const auto readCStr = [](const void* pData, const size_t size) {
						std::vector< char > charList;
						charList.resize( size + 1 );
						memcpy(&charList[0], pData, size);
						charList[size] = 0;
						return std::string(&charList[0]);
					};

					switch( node.eNodeType ) {
						case EnumNodeType::TypeStruct:
						case EnumNodeType::TypeClass:
						case EnumNodeType::TypeUnion: {
							std::string dump = "";
							eachStructField(node, [&](const auto fieldNode) {
								const auto fieldTypeNode = _getNode(fieldNode.typeDataMemberField.elementTypeID);
								if ( !fieldTypeNode.valid )
									return;
								
								if ( dump.length() )
									dump +=  + ( dumpJson ? "," : "" );
								
								if ( dump.length() && dump[ dump.length() - 1 ] != '\n' )
									dump += "\n";

								dump += GAP + jsonQuotesCond(fieldNode.name, dumpJson) + ": ";
								dump += dumpStruct(fieldTypeNode, pData + fieldNode.typeDataMemberField.offset, gapLv + 1);
							});
							dump = "{\n" + dump;
							dump += "\n";
							dump += GAP_PREV + "}";
							
							return dump;
						}
						break;
						
						case EnumNodeType::TypeScalar: {
							std::string valueStr = "";
							
							const auto nodeName = std::string(node.name);
							const auto error = dynamicDefineType< false >(node, [&](const auto varType) {
								const auto value = *reinterpret_cast< const decltype(varType)*  >( pData );
								
								valueStr = std::to_string(value);
								
								if ( nodeName == "bool" )
									valueStr = value ? "true" : "false";
							});
							
							if ( valueStr.length() )
								return jsonCorrectScalarValueCond(valueStr, node, dumpJson);
							
							errorAdd(error);
							return "";
						}
						break;
						
						case EnumNodeType::TypeBitfield: {
							const auto nodeNext = _getNode(node.typeBitfield.elementTypeID);
							if ( !nodeNext.valid )
								return "";
							
							if ( nodeNext.eNodeType != EnumNodeType::TypeScalar ) {
								errorAdd("Invald TypeBitfield");
								return "";
							}
							
							std::string valueStr;
							const auto error = dynamicDefineType< true >(nodeNext, [&](const auto varType) {
								const auto value = *reinterpret_cast< const decltype(varType)*  >( pData );
								const auto bits = (value >> node.typeBitfield.startingPosition) & ( ( 1 << node.typeBitfield.bits ) - 1 );
								valueStr = std::to_string(bits);
							});
							
							if ( valueStr.length() )
								return jsonCorrectScalarValueCond(valueStr, nodeNext, dumpJson);
							
							errorAdd(error);
							return "";
						}
						break;
						
						case EnumNodeType::TypeArray: {
							const auto itemTypeNode = _getNode(node.typeArray.elementTypeID);
							if ( !itemTypeNode.valid )
								return "";
							
							const size_t count = node.size / itemTypeNode.size;
							
							const bool isItemNodeScalar = itemTypeNode.eNodeType == EnumNodeType::TypeScalar;
							
							if ( isItemNodeScalar && !strcmp(itemTypeNode.name, "char") ) {
								const auto bText = readCStr(pData, node.size);
								return "\"" + ( dumpJson ? jsonString(bText) : bText ) + "\"";
							}
							
							std::string dump = "[";
							if ( !isItemNodeScalar )
								dump += "\n";
							for(size_t i = 0; i != count; i++) {
								if ( !isItemNodeScalar )
									dump += GAP;
								
								dump += dumpStruct(itemTypeNode, pData + itemTypeNode.size * i, gapLv + 1);
								
								if ( i + 1 != count )
									dump += ", ";
								
								if ( !isItemNodeScalar )
									dump += "\n";
							}
							dump += ( isItemNodeScalar ? "" : GAP_PREV ) + "]";
							
							return dump;
						}
						break;
						
						case EnumNodeType::TypePointer: {
							return ptrToHex( *reinterpret_cast< const uint64_t* >( pData ), dumpJson );
						}
						break;
					}
					
					errorAdd("Invalid type node '", (int)node.eNodeType, "'");
					return "";
				}


				static std::string ptrToHex(const uint64_t ptr, const bool dumpJson = false) {
					std::string ret = "";
					std::stringstream sst;
						
					sst << (void*)ptr;
					sst >> ret;
					return jsonQuotesCond("0x" + ret, dumpJson);
				}
		};
		
		auto dumpStruct(const ATF::Reflect::Node& node, const uint8_t* pData, const TStructDumperOptions& dumperOptions = {}, const StructNodeExtends& nodeEx = {}) {
			StructDumper sd(dumperOptions, nodeEx);
			const auto dump = sd.dumpStruct(node, pData);
			return std::make_pair(sd, dump);
		}

		std::string dumpStructType(const ATF::Reflect::Node& node, const StructNodeExtends& nodeEx = {}) {
			if ( node.valid ) {
				switch( node.eNodeType ) {
					case EnumNodeType::TypeVoid   :
					case EnumNodeType::TypeScalar :
					case EnumNodeType::TypeStruct :
					case EnumNodeType::TypeClass  :
					case EnumNodeType::TypeUnion  :
						return node.name;

					case EnumNodeType::TypePointer:
						return dumpStructType(nodeEx.getNode(node.typePointer.elementTypeID)) + "*";
					
					case EnumNodeType::TypeArray  : {
						const auto nextNode = nodeEx.getNode(node.typeArray.elementTypeID);
						return dumpStructType(nextNode) + "[" + std::to_string(node.size/nextNode.size) + "]";
					}
					
					case EnumNodeType::TypeBitfield: {
						const auto nextNode = nodeEx.getNode(node.typeBitfield.elementTypeID);
						return dumpStructType(nextNode) + " : {" + std::to_string(node.typeBitfield.startingPosition) + ":" + std::to_string(node.typeBitfield.bits) + "}";
					}
						
					default:
						break;
				}
			}
			
			return "{InvalidNode}";
		}

	}
}
