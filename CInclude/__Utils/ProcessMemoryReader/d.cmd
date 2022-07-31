
if not defined AlrInitEvrMsvc (
	@set AlrInitEvrMsvc=1
	"c:\Program Files (x86)\Microsoft Visual Studio\2017\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
)

del main.exe
cls

start /REALTIME /WAIT /B cl.exe /Od /EHc /EHs main.cpp


main -target:"ZoneServerUD_x64.exe" -baseAddress:0x140000000 -dumpJson -api-host:"127.0.0.1" -api-port:10200

