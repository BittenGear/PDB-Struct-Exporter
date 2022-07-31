#pragma once

#define ATF_NON_COPYABLE_CLASS(name)		\
	name(const name&) = delete;				\
	name(name&&) = delete;					\
	name& operator=(const name&) = delete;	\
	name& operator=(name&&) = delete;

#pragma pack(push, 1)
namespace ATF {

	template< class T >
	using $F = T;

	template< class T, const size_t size >
	using $A = T[size];

	struct $VFUNCTAB { void* $vfptr = nullptr; };

	namespace __Local__ {
	
		struct TVersion {
			uint32_t major = 0;
			uint32_t minor = 0;
			uint32_t build = 0;
			
			bool compare(const TVersion& other) const {
				return (major == other.major) && (minor == other.minor);
			}
		};

		struct TSection {
			bool         valid           = false;
			uint64_t     rva             = 0;
			uint64_t     size            = 0;
			uint64_t     align           = 0;
			uint64_t     characteristics = 0;
			const char * name            = "";
		};
		
	}

	namespace CheckAll {

		template< class T >
		bool checkIntegerType(const bool integer_ = false) {
			const T val_f = static_cast< T >( +0  );
			const T val_s = static_cast< T >( 0.1 );
			return (val_f == val_s) ? integer_ : !integer_;
		}
		template< class T >
		bool checkUnsignedType(const bool unsigned_ = false) {
			const T val_f = static_cast< T >( +0 );
			const T val_s = static_cast< T >( -1 );
			return (val_f < val_s) ? unsigned_ : !unsigned_;
		}
		
	}

}
#pragma pack(pop)