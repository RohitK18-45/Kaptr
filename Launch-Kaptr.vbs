Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
ScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

WshShell.CurrentDirectory = ScriptDir
WshShell.Environment("PROCESS")("AUTO_SHUTDOWN") = "1"

' Start node server hidden (0 = hidden window)
WshShell.Run "node server.js", 0, False

' Give server time to bind
WScript.Sleep 600

TargetUrl = "http://kaptr.localtest.me"

ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
EdgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

If fso.FileExists(ChromePath) Then
    WshShell.Run """" & ChromePath & """ --app=" & TargetUrl, 1, False
ElseIf fso.FileExists(EdgePath) Then
    WshShell.Run """" & EdgePath & """ --app=" & TargetUrl, 1, False
Else
    WshShell.Run TargetUrl, 1, False
End If
