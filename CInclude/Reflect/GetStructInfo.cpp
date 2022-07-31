#pragma once
 
namespace ATF {
	namespace Reflect {
		#pragma pack(push, 1)

		enum class EnumNodeType : uint8_t {
			TypeVoid     = 1, 
			TypeScalar   = 2,
			TypeBitfield = 3,			

			TypePointer  = 4,
			TypeArray    = 5,
			TypeStruct   = 6,
			TypeClass    = 7,
			TypeUnion    = 8,
			
			TypeDataMemberField = 10,
			TypeStaticDataMemberField = 11,
			TypeVar = 12,
		};

		struct Node {
			EnumNodeType eNodeType = (EnumNodeType)0xFF;
			uint32_t     size;
			
			struct NodeScalar {
				int32_t nameID;
			};
			struct NodeStruct {
				int32_t nameID;
				int32_t fieldStartID;
				int32_t fieldCount;
			};
			struct NodeBitfield {				
				int32_t  elementTypeID;
				uint32_t startingPosition;
				uint32_t bits;
			};
			struct NodePointer {
				int32_t  elementTypeID;
			};
			struct NodeDataMemberField {
				int32_t  elementTypeID;
				int32_t  nameID;
				uint32_t offset;
			};
			struct NodeVar {
				int32_t  elementTypeID;
				int32_t  nameID;
				uint64_t address;
			};
			
			union {
				NodeScalar          typeVoid;
				NodeScalar          typeScalar;
				
				NodeStruct          typeStruct;
				NodeStruct          typeClass;
				NodeStruct          typeUnion;
				
				NodeBitfield        typeBitfield;
				
				NodePointer         typePointer;
				NodePointer         typeArray;
				
				NodeDataMemberField typeDataMemberField;
				
				NodeVar             typeStaticDataMemberField;
				NodeVar             typeVar;
			};
			
			bool valid = false;
			const char* name;
			
			int32_t id = 0;
		};
		
		const char* getStructNodeName(const int32_t id) {
			if ( id < 0 )
				return "";
						
			if ( !id )
				return "";
			
			return __Local__::__StructInfoNameList[ id ];
		}
		const Node  getStructNode(const int32_t nodeInternalID) {
			if ( nodeInternalID < 0 )
				return Node{};
			
			if ( nodeInternalID >= __Local__::__StructInfoCount )
				return Node{};
			
			if ( !nodeInternalID )
				return Node{};

			const uint32_t* pOffsetList = reinterpret_cast< const uint32_t* >( &__Local__::__StructInfoOffsetDataMemory[0] );
			const uint32_t offset = pOffsetList[ nodeInternalID ];
			
			const uint8_t* pData = reinterpret_cast< const uint8_t* >( &__Local__::__StructInfoDataMemory[0] );

			Node node = *( reinterpret_cast< const Node* >( &pData[ offset ] ) );
			node.name = "";

			switch( node.eNodeType ) {
				case EnumNodeType::TypeVoid                 : node.name = getStructNodeName(node.typeVoid           .nameID); break;
				case EnumNodeType::TypeScalar               : node.name = getStructNodeName(node.typeScalar         .nameID); break;
				case EnumNodeType::TypeStruct               : node.name = getStructNodeName(node.typeStruct         .nameID); break;
				case EnumNodeType::TypeClass                : node.name = getStructNodeName(node.typeStruct         .nameID); break;
				case EnumNodeType::TypeUnion                : node.name = getStructNodeName(node.typeStruct         .nameID); break;
				case EnumNodeType::TypeDataMemberField      : node.name = getStructNodeName(node.typeDataMemberField.nameID); break;
				case EnumNodeType::TypeStaticDataMemberField: node.name = getStructNodeName(node.typeVar            .nameID); break;
				case EnumNodeType::TypeVar                  : node.name = getStructNodeName(node.typeVar            .nameID); break;
				default:
					break;
			}
			
			node.valid = true;
			node.id = nodeInternalID;
			
			return node;
		}
		
		template< class TFun >
		void eachStructField(const Node& node, const TFun fun) {
			if ( !node.valid )
				return;
			
			if ( !(
				( node.eNodeType == EnumNodeType::TypeStruct ) ||
				( node.eNodeType == EnumNodeType::TypeClass  ) ||
				( node.eNodeType == EnumNodeType::TypeUnion  )
			) )
				return;

			for(int32_t id = node.typeStruct.fieldStartID; id < node.typeStruct.fieldStartID + node.typeStruct.fieldCount; id++) {
				const auto node = getStructNode(id);
				if ( node.valid )
					fun(node);
			}
		}

		template< class TFun >
		void eachStructNode(const TFun fun) {
			for(int32_t id = 0; id < __Local__::__StructInfoCount; id++) {
				const auto node = getStructNode(id);
				if ( node.valid )
					fun(node);
			}
		}
		
		#pragma pack(pop)
	}
}