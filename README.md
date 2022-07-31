# PDB-Struct-Exporter
Fully automatic export of structures
  > Only win, x64, old pdb
- Requires
  - nodejs (ver > 18.x.x) 
  - cvdump.exe ( includes in ./bin ) 
  - undname.exe ( from msvc build tools, includes in ./bin )
- Example
  > ```node "PDB-Struct-Exporter-main/index.js" -in:"my-pdb-file.pdb" -out:"./ATF"```
