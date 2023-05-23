!include 'WinVer.nsh'
!include "MUI2.nsh"
!include "x64.nsh"
!include "WordFunc.nsh"

!define APP_NAME "FWCloud-VPN"
!define COMP_NAME "SOLTECSIS SOLUCIONES TECNOLOGICAS, S.L."
!define WEB_SITE "https://fwcloud.net"
!define VERSION "1.0.0.0"
!define COPYRIGHT "SOLTECSIS SOLUCIONES TECNOLOGICAS, S.L. 2020"
!define DESCRIPTION "Get your VPN ready to go in seconds"
!define INSTALLER_NAME "fwcloud-vpn.exe"
!define MAIN_APP_EXE "openvpn-fwcloud.msi"
!define ICON "fwcloud-vpn.ico"
!define BANNER "banner.bmp"
!define LICENSE_TXT "fwcloud-vpn_TC.txt"
;!define CONFIG_FILE "fwcloud-vpn.ovpn" -- Now we use a command line parameter for this

!define OpenVPN_VERSION "2.6.4" ; This is the version of openvpn.exe we include within the installer

!define INSTALL_DIR "$PROGRAMFILES64\${APP_NAME}"
!define INSTALL_TYPE "SetShellVarContext all"

; User vars can only be global
var OpenVPN_Path
var OpenVPN_Config_Path
var OpenVPN_Upgrade_Needed
var CONFIG_FILE

Unicode True

######################################################################

VIProductVersion  "${VERSION}"
VIAddVersionKey "ProductName"  "${APP_NAME}"
VIAddVersionKey "CompanyName"  "${COMP_NAME}"
VIAddVersionKey "LegalCopyright"  "${COPYRIGHT}"
VIAddVersionKey "FileDescription"  "${DESCRIPTION}"
VIAddVersionKey "FileVersion"  "${VERSION}"

######################################################################

SetCompressor /SOLID Lzma
Name "${APP_NAME}"
Caption "${APP_NAME}"
OutFile "${INSTALLER_NAME}"
BrandingText "${APP_NAME}"
InstallDir "${INSTALL_DIR}"

######################################################################

!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_WELCOMEFINISHPAGE_BITMAP "${BANNER}"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "${BANNER}"

######################################################################

!define MUI_FINISHPAGE_SHOWREADME
!define MUI_FINISHPAGE_SHOWREADME_TEXT $(VISIT_TEXT)
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION "LaunchWeb"

!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION "LaunchApp"

!define MUI_FINISHPAGE_LINK "FWCloud VPN Website"
!define MUI_FINISHPAGE_LINK_LOCATION ${WEB_SITE}

Function LaunchWeb
	SetOutPath $TEMP
	ExecShell "open" "${WEB_SITE}" SW_SHOWNORMAL
FunctionEnd

Function LaunchApp
	SetOutPath $TEMP
	ExecShell "" "$OpenVPN_Path\bin\openvpn-gui.exe"
FunctionEnd

######################################################################

!define MUI_ABORTWARNING
!define MUI_UNABORTWARNING

!insertmacro MUI_PAGE_WELCOME

!ifdef LICENSE_TXT
	!insertmacro MUI_PAGE_LICENSE "${LICENSE_TXT}"
!endif

!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

######################################################################

;Languages
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Spanish"
!insertmacro MUI_LANGUAGE "French"
!insertmacro MUI_LANGUAGE "German"

LangString Msg_OpenVPN_Found ${LANG_ENGLISH} "OpenVPN was installed before in this computer. If it is running it will be stopped during the installation"
LangString Msg_OpenVPN_Found ${LANG_SPANISH} "OpenVPN estaba ya instalado en este equipo. Si se está ejecutando será detenido durante la instalación"
LangString Msg_OpenVPN_Found ${LANG_FRENCH} "OpenVPN était déjà installé sur cet ordinateur. S'il est en cours d'exécution, il sera arrêté pendant l'installation"
LangString Msg_OpenVPN_Found ${LANG_GERMAN} "OpenVPN wurde zuvor auf diesem Computer installiert. Wenn es ausgeführt wird, wird es während der Installation gestoppt"

LangString Msg_Renamed ${LANG_ENGLISH} "Previous OpenVPN configuration file has been renamed as $CONFIG_FILE.old"
LangString Msg_Renamed ${LANG_SPANISH} "El anterior fichero de configuración de OpenVPN ha sido renombrado como $CONFIG_FILE.old"
LangString Msg_Renamed ${LANG_FRENCH} "Le fichier de configuration OpenVPN précédent a été renommé $CONFIG_FILE.old"
LangString Msg_Renamed ${LANG_GERMAN} "Die vorherige OpenVPN-Konfigurationsdatei wurde in $CONFIG_FILE.old umbenannt"

LangString Msg_OpenVPN_Not_Modified ${LANG_ENGLISH} "Previous OpenVPN config files are kept at $0 $\r$\n$\r$\nNew OpenVPN config file is $0\$CONFIG_FILE"
LangString Msg_OpenVPN_Not_Modified ${LANG_SPANISH} "Los anteriores ficheros configuración de OpenVPN se mantienen en $0 $\r$\n$\r$\nEl nuevo fichero de configuración de OpenVPN es $0\$CONFIG_FILE"
LangString Msg_OpenVPN_Not_Modified ${LANG_FRENCH} "Les fichiers de configuration OpenVPN précédents sont conservés à $0 $\r$\n$\r$\nLe nouveau fichier de configuration OpenVPN est $0\$CONFIG_FILE"
LangString Msg_OpenVPN_Not_Modified ${LANG_GERMAN} "Vorherige OpenVPN-Konfigurationsdateien werden bei $0 gehalten $\r$\n$\r$\nNeue OpenVPN-Konfigurationsdatei ist $0\$CONFIG_FILE"

LangString Msg_Unsupported ${LANG_ENGLISH} "Sorry, but your Windows version is unsupported. Windows 7 or above is required"
LangString Msg_Unsupported ${LANG_SPANISH} "Lo sentimos pero su versión de Windows no es compatible. Se requiere Windows 7 o superior"
LangString Msg_Unsupported ${LANG_FRENCH} "Désolé, mais votre version Windows n'est pas prise en charge. Windows 7 ou supérieur est requis"
LangString Msg_Unsupported ${LANG_GERMAN} "Entschuldigung, aber Ihre Windows-Version wird nicht unterstützt. Windows 7 oder höher ist erforderlich"

LangString VISIT_TEXT ${LANG_ENGLISH} "Visit our Web site for more information"
LangString VISIT_TEXT ${LANG_SPANISH} "Visite nuestro sitio Web para obtener más información"
LangString VISIT_TEXT ${LANG_FRENCH} "Visitez notre site web pour plus d'informations"
LangString VISIT_TEXT ${LANG_GERMAN} "Besuchen Sie unsere Website für weitere Informationen"

######################################################################

Function .onInit
	!insertmacro MUI_LANGDLL_DISPLAY
	InitPluginsDir
	StrCpy $CONFIG_FILE `"${CONFIG_F}"`
FunctionEnd

!macro RemoveSurroundingQuotes un
Function ${un}RemoveSurroundingQuotes
  Exch $0 ; The string we want to remove quotes from
  Push $2 ; the first character
  Push $3 ; the last character

  StrCpy $2 $0 1
  StrCpy $3 $0 "" -1

  StrCmp $2 '"' 0 no_leading_quote
    StrCmp $3 '"' 0 no_trailing_quote
      StrCpy $0 $0 -1 1

no_leading_quote:
no_trailing_quote:
  Pop $3
  Pop $2
  Exch $0
FunctionEnd
!macroend

!insertmacro RemoveSurroundingQuotes ""

Function Check_Version ; We check if our OpenVPN included version is newer 
	StrCpy $OpenVPN_Path $0
	Push $0 ; Store $0 value

	FileOpen $0 check_version.bat w
        FileWrite $0 "@echo off $\r$\n"
        FileWrite $0 "Set MyPath=$OpenVPN_Path\bin $\r$\n"
        FileWrite $0 '"%MyPath%\openvpn.exe" --version | findStr "^OpenVPN" > t_v.txt $\r$\n'
        FileWrite $0 'for /f "tokens=2" %%i in (t_v.txt) do set Version=%%i $\r$\n'
        FileWrite $0 "echo %Version% $\r$\n"
        FileClose $0

	FileOpen $0 stop.bat w
	FileWrite $0 "@echo off $\r$\n"
        FileWrite $0 "taskkill /F /IM openvpn-gui.exe $\r$\n"
	FileClose $0

	;ExecShellWait "" "check_version.bat" "" SW_HIDE
	nsExec::ExecToStack '"check_version.bat"'
	 Pop $0
	 Pop $1
	${VersionCompare} $1 ${OpenVPN_VERSION} $R0 ; $R0==0 versions are equal, $R0==1 first version is newer, $R0==2 second version is newer
	${If} $R0 == "2" ; it is newer
		StrCpy $OpenVPN_Upgrade_Needed "1"
	${Else}
		StrCpy $OpenVPN_Upgrade_Needed "0"
	${EndIF}
	Pop $0 ; Restore $0 value
FunctionEnd

Function FindOpenVPN
	;Push $0
	${If} ${RunningX64}
		SetRegView 64
	${EndIf}

	ReadRegStr $0 HKLM "SOFTWARE\OpenVPN" ""
        ${If} ${Errors}
                ;MessageBox MB_OK "Key not found"
		StrCpy $OpenVPN_Upgrade_Needed "1"
                Push "0" ; No OpenVPN instalation found 
	${Else}
		Call Check_Version
		Push $0 ; Save OpenVPN install_dir
		ReadRegStr $0 HKLM "SOFTWARE\OpenVPN" "config_dir"
		${If} ${Errors}
			;MessageBox MB_OK "Key not found"
			Push "0" ; No config_dir found
		${Else}
			MessageBox MB_OK|MB_ICONEXCLAMATION $(Msg_OpenVPN_Found)
			ExecShellWait "" "stop.bat" "" SW_HIDE
			${If} $0 == ""
				;MessageBox MB_OK "Exists but it is empty"
				Push "0" ; No valid OpenVPN config_dir found
			${Else}
				Push $0  ; Saved config_dir that is in $0

				Push $CONFIG_FILE ; We remove quotes because IfFileExists and Delete don't like
				Call RemoveSurroundingQuotes
				Pop $R0

				IfFileExists $0\$R0 0 not_exists
					Delete '$0\$R0.old'
					Rename '$0\$CONFIG_FILE' '$0\$CONFIG_FILE.old'
					;MessageBox MB_OK|MB_ICONINFORMATION $(Msg_Renamed)
				not_exists: ;MessageBox MB_OK|MB_ICONINFORMATION $(Msg_OpenVPN_Not_Modified)
			${EndIf}
		${EndIf}
	${EndIf}

	${If} ${RunningX64}
		SetRegView LastUsed
	${EndIf}
	;Pop $0
FunctionEnd

######################################################################

Section -MainProgram
	${INSTALL_TYPE}
	StrCpy $OpenVPN_Path "C:\Program Files\OpenVPN"
	StrCpy $OpenVPN_Config_Path "C:\Program Files\OpenVPN\config"

	SetOverwrite ifnewer
	SetOutPath "$INSTDIR"

	Call FindOpenVPN ; Check if OpenVPN was installed before
	Pop $R0
	${If} $R0 != "0" ; There is a valid OpenVPN config_dir
		StrCpy $OpenVPN_Config_Path $R0
		Pop $R1
		${If} $R1 != "0" ; There is a valid installation dir
			StrCpy $OpenVPN_Path $R1
		${EndIf}
	${EndIf}

        FileOpen $0 launcher.bat w
        FileWrite $0 "openvpn-fwcloud.msi /S /D=$OpenVPN_Path$\r$\n"
        FileWrite $0 "exit$\r$\n"
        FileClose $0
	File /r /x *.nsi /x ${INSTALLER_NAME} ".\\"

	${If} ${RunningX64}
		Rename $InstDir\OpenVPN-versions\OpenVPN-2.6.4-I001-amd64.msi $InstDir\openvpn-fwcloud.msi
	${Else}
		Rename $InstDir\OpenVPN-versions\OpenVPN-2.6.4-I001-x86.msi $InstDir\openvpn-fwcloud.msi
	${EndIf}

	${If} $OpenVPN_Upgrade_Needed == "1"
		ExecShellWait "" "launcher.bat" "" SW_HIDE
	${EndIf}

	Rename $InstDir\$CONFIG_FILE $OpenVPN_Config_Path\$CONFIG_FILE


SectionEnd

	Function .onInstSuccess
		SetOutPath $TEMP
		Delete $InstDir\launcher.bat
		Delete $InstDir\check_version.bat
		Delete $InstDir\t_v.txt
		Delete $InstDir\banner.bmp
		Delete $InstDir\fwcloud-vpn.ico
		Delete $InstDir\fwcloud-vpn_TC.txt
		Delete $InstDir\fwcloud-vpn.nsi
		Delete $InstDir\openvpn-fwcloud.msi
		RmDir /r $InstDir\OpenVPN-versions
		Delete $InstDir\stop.bat
		RmDir /r $InstDir
	FunctionEnd	

