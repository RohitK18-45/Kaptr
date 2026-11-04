Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
ScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

WshShell.CurrentDirectory = ScriptDir
WshShell.Environment("PROCESS")("AUTO_SHUTDOWN") = "1"

' Start node server hidden (0 = hidden window)
WshShell.Run "node server.js", 0, False

' Give server 800ms to bind, then open browser
WScript.Sleep 800
WshShell.Run "http://localhost:3000"
