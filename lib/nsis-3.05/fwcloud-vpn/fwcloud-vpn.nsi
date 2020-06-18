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
!define MAIN_APP_EXE "opengui-fwcloud.exe"
!define ICON "fwcloud-vpn.ico"
!define BANNER "banner.bmp"
!define LICENSE_TXT "fwcloud-vpn_TC.txt"
;!define CONFIG_FILE "fwcloud-vpn.ovpn"

!define OpenVPN_VERSION "2.4.9" ; This is the version of openvpn.exe we include within the installer

!define INSTALL_DIR "$PROGRAMFILES64\${APP_NAME}"
!define INSTALL_TYPE "SetShellVarContext all"
!define REG_ROOT "HKLM"
!define REG_APP_PATH "Software\Microsoft\Windows\CurrentVersion\App Paths\${MAIN_APP_EXE}"
!define UNINSTALL_PATH "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
!define REG_START_MENU "Start Menu Folder"

; User vars can only be global
var SM_Folder
var OpenVPN_Path
var OpenVPN_Config_Path
var OpenVPN_Upgrade_Needed
var CONFIG_FILE


Unicode True

;ShowInstDetails show

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
InstallDirRegKey "${REG_ROOT}" "${REG_APP_PATH}" ""
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
	ExecShell "open" "${WEB_SITE}" SW_SHOWNORMAL
FunctionEnd

Function LaunchApp
	ExecShell "" "$OpenVPN_Path\bin\openvpn-gui.exe"
FunctionEnd

######################################################################

!define MUI_ABORTWARNING
!define MUI_UNABORTWARNING

!insertmacro MUI_PAGE_WELCOME

!ifdef LICENSE_TXT
	!insertmacro MUI_PAGE_LICENSE "${LICENSE_TXT}"
!endif

!insertmacro MUI_PAGE_DIRECTORY

!ifdef REG_START_MENU
	!define MUI_STARTMENUPAGE_DEFAULTFOLDER "${APP_NAME}"
	!define MUI_STARTMENUPAGE_REGISTRY_ROOT "${REG_ROOT}"
	!define MUI_STARTMENUPAGE_REGISTRY_KEY "${UNINSTALL_PATH}"
	!define MUI_STARTMENUPAGE_REGISTRY_VALUENAME "${REG_START_MENU}"
	!insertmacro MUI_PAGE_STARTMENU Application $SM_Folder
!endif

!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

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

LangString UNINSTALL_TEXT ${LANG_ENGLISH} "FWCloud-VPN configuration has been removed from your computer $\r$\n$\r$\n FWCloud-VPN makes use of OpenVPN. This may still be required on your computer and will not be uninstalled $\r$\n$\r$\n If you want to remove it you can do it by running: "
LangString UNINSTALL_TEXT ${LANG_SPANISH} "Se eliminado la configuración de FWCloud-VPN de su equipo $\r$\n$\r$\n FWCloud-VPN hace uso de OpenVPN. Este podría seguir siendo necesario en su equipo y no se desinstalará $\r$\n$\r$\n Si desea eliminarlo puede hacerlo ejecutando: "
LangString UNINSTALL_TEXT ${LANG_FRENCH} "La configuration FWCloud-VPN a été supprimée de votre ordinateur $\r$\n$\r$\n FWCloud-VPN utilise OpenVPN. Cela peut toujours être requis sur votre ordinateur et ne sera pas désinstallé $\r$\n$\r$\n Si vous souhaitez le supprimer, vous pouvez le faire en exécutant: "
LangString UNINSTALL_TEXT ${LANG_GERMAN} "Die FWCloud-VPN-Konfiguration wurde von Ihrem Computer entfernt. $\r$\n$\r$\n FWCloud-VPN verwendet OpenVPN. Dies ist möglicherweise weiterhin auf Ihrem Computer erforderlich und wird nicht deinstalliert $\r$\n$\r$\n Wenn Sie es entfernen möchten, können Sie es ausführen, indem Sie es ausführen: "

######################################################################

Function .onInit
	!insertmacro MUI_LANGDLL_DISPLAY
	InitPluginsDir
;StrCpy $CONFIG_FILE '"${CONFIG_F}"'
StrCpy $CONFIG_FILE `"${CONFIG_F}"`
FunctionEnd

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
                ;MessageBox MB_OK "Clave no encontrada"
		StrCpy $OpenVPN_Upgrade_Needed "1"
                Push "0" ; No OpenVPN instalation found 
	${Else}
		Call Check_Version
		Push $0 ; Save OpenVPN install_dir
		ReadRegStr $0 HKLM "SOFTWARE\OpenVPN" "config_dir"
		${If} ${Errors}
			;MessageBox MB_OK "Clave no encontrada"
			Push "0" ; No config_dir found
		${Else}
			MessageBox MB_OK|MB_ICONEXCLAMATION $(Msg_OpenVPN_Found)
			${If} $0 == ""
				;MessageBox MB_OK "Exists but it is empty"
				Push "0" ; No valid OpenVPN config_dir found
			${Else}
				Push $0  ; Saved config_dir that is in $0
MessageBox MB_OK `IfFileExists $0\$CONFIG_FILE`
				IfFileExists $0\$CONFIG_FILE 0 not_exists
					Delete $0\$CONFIG_FILE.old
					Rename $0\$CONFIG_FILE $0\$CONFIG_FILE.old
					MessageBox MB_OK|MB_ICONINFORMATION $(Msg_Renamed)
				not_exists: MessageBox MB_OK|MB_ICONINFORMATION $(Msg_OpenVPN_Not_Modified)
			${EndIf}
		${EndIf}
	${EndIf}

	${If} ${RunningX64}
		SetRegView LastUsed
	${EndIf}
	;Pop $0
FunctionEnd

Function un.FindOpenVPN
        ;Push $0
        ${If} ${RunningX64}
                SetRegView 64
        ${EndIf}

        ReadRegStr $0 HKLM "SOFTWARE\OpenVPN" ""
        ${If} ${Errors}
                ;MessageBox MB_OK "Clave no encontrada"
                StrCpy $OpenVPN_Upgrade_Needed "1"
                Push "0" ; No OpenVPN instalation found
        ${Else}
                Push $0 ; Save OpenVPN install_dir
                ReadRegStr $0 HKLM "SOFTWARE\OpenVPN" "config_dir"
                ${If} ${Errors}
                        ;MessageBox MB_OK "Clave no encontrada"
                        Push "0" ; No config_dir found
                ${Else}
                        ${If} $0 == ""
                                ;MessageBox MB_OK "Exists but it is empty"
                                Push "0" ; No valid OpenVPN config_dir found
                        ${Else}
                                Push $0  ; Saved config_dir that is in $0
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
        FileWrite $0 "opengui-fwcloud.exe /S /D=$OpenVPN_Path$\r$\n"
        FileWrite $0 "exit$\r$\n"
        FileClose $0
	File /r /x *.nsi /x ${INSTALLER_NAME} ".\\"

	${If} ${AtLeastWin10}
		Rename $InstDir\OpenVPN-versions\openvpn-install-2.4.9-I601-Win10.exe $InstDir\opengui-fwcloud.exe
	${ElseIf} ${AtLeastWin7}
		Rename $InstDir\OpenVPN-versions\openvpn-install-2.4.9-I601-Win7.exe $InstDir\opengui-fwcloud.exe
	${Else}
		MessageBox MB_OK|MB_ICONEXCLAMATION $(Msg_Unsupported)
		abort
	${EndIf}

	${If} $OpenVPN_Upgrade_Needed == "1"
		ExecShellWait "" "launcher.bat" "" SW_HIDE
	${EndIf}

	Rename $InstDir\$CONFIG_FILE $OpenVPN_Config_Path\$CONFIG_FILE


SectionEnd

	Function .onInstSuccess
		Delete $InstDir\launcher.bat
		Delete $InstDir\check_version.bat
		Delete $InstDir\t_v.txt
		Delete $InstDir\banner.bmp
		Delete $InstDir\fwcloud-vpn.nsi
		Delete $InstDir\opengui-fwcloud.exe
		RmDir /r $InstDir\OpenVPN-versions
		;RmDir /r $InstDir\VPN
	FunctionEnd	


######################################################################

Section -Icons_Reg
SetOutPath "$INSTDIR"
WriteUninstaller "$INSTDIR\uninstall-FW.exe"

!ifdef REG_START_MENU
	!insertmacro MUI_STARTMENU_WRITE_BEGIN Application
	CreateDirectory "$SMPROGRAMS\$SM_Folder"
	;CreateShortCut "$SMPROGRAMS\$SM_Folder\${APP_NAME}.lnk" "$INSTDIR\${MAIN_APP_EXE}"
	;CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${MAIN_APP_EXE}"
	CreateShortCut "$SMPROGRAMS\$SM_Folder\Terms & Conditions ${APP_NAME}.lnk" "$INSTDIR\${LICENSE_TXT}" 
	CreateShortCut "$SMPROGRAMS\$SM_Folder\Uninstall ${APP_NAME}.lnk" "$INSTDIR\uninstall-FW.exe" "$INSTDIR\${ICON}"

	!ifdef WEB_SITE
		WriteIniStr "$INSTDIR\${APP_NAME} Website.url" "InternetShortcut" "URL" "${WEB_SITE}"
		CreateShortCut "$SMPROGRAMS\$SM_Folder\${APP_NAME} Website.lnk" "$INSTDIR\${APP_NAME} Website.url"
	!endif
	!insertmacro MUI_STARTMENU_WRITE_END
!endif

!ifndef REG_START_MENU
	CreateDirectory "$SMPROGRAMS\${APP_NAME}"
	;CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${MAIN_APP_EXE}"
	;CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${MAIN_APP_EXE}"
	CreateShortCut "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk" "$INSTDIR\${LICENSE_TXT}"
	CreateShortCut "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk" "$INSTDIR\uninstall-FW.exe" "$INSTDIR\$ICON"

	!ifdef WEB_SITE
		WriteIniStr "$INSTDIR\${APP_NAME} website.url" "InternetShortcut" "URL" "${WEB_SITE}"
		CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME} Website.lnk" "$INSTDIR\${APP_NAME} website.url"
	!endif
!endif

WriteRegStr ${REG_ROOT} "${REG_APP_PATH}" "" "$INSTDIR\${MAIN_APP_EXE}"
WriteRegStr ${REG_ROOT} "${UNINSTALL_PATH}"  "DisplayName" "${APP_NAME}"
WriteRegStr ${REG_ROOT} "${UNINSTALL_PATH}"  "UninstallString" "$INSTDIR\uninstall-FW.exe"
WriteRegStr ${REG_ROOT} "${UNINSTALL_PATH}"  "DisplayIcon" "$INSTDIR\${MAIN_APP_EXE}"
WriteRegStr ${REG_ROOT} "${UNINSTALL_PATH}"  "DisplayVersion" "${VERSION}"
WriteRegStr ${REG_ROOT} "${UNINSTALL_PATH}"  "Publisher" "${COMP_NAME}"

!ifdef WEB_SITE
	WriteRegStr ${REG_ROOT} "${UNINSTALL_PATH}"  "URLInfoAbout" "${WEB_SITE}"
!endif
SectionEnd

######################################################################

Section Uninstall

Call un.FindOpenVPN ; Check if OpenVPN was installed before
Pop $R0
${If} $R0 != "0" ; There is a valid OpenVPN config_dir
	Delete $R0\$CONFIG_FILE
	Delete $R0\$CONFIG_FILE.old
        Pop $R1
        ${If} $R1 != "0" ; There is a valid installation dir
		MessageBox MB_OK|MB_ICONEXCLAMATION "$(UNINSTALL_TEXT) $R1\Uninstall.exe"
		;ExecWait '"$R1\Uninstall.exe" /S' $1
	${EndIF}
${EndIF}

${INSTALL_TYPE}

RmDir /r "$INSTDIR"

!ifdef REG_START_MENU
	!insertmacro MUI_STARTMENU_GETFOLDER "Application" $SM_Folder
	;Delete "$SMPROGRAMS\$SM_Folder\${APP_NAME}.lnk"
	Delete "$SMPROGRAMS\$SM_Folder\Uninstall ${APP_NAME}.lnk"
	!ifdef WEB_SITE
		Delete "$SMPROGRAMS\$SM_Folder\${APP_NAME} Website.lnk"
	!endif
	;Delete "$DESKTOP\${APP_NAME}.lnk"

	RmDir "$SMPROGRAMS\$SM_Folder"
!endif

!ifndef REG_START_MENU
	;Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
	Delete "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk"
	!ifdef WEB_SITE
		Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME} Website.lnk"
	!endif
	;Delete "$DESKTOP\${APP_NAME}.lnk"

	RmDir "$SMPROGRAMS\${APP_NAME}"
!endif

DeleteRegKey ${REG_ROOT} "${REG_APP_PATH}"
DeleteRegKey ${REG_ROOT} "${UNINSTALL_PATH}"
SectionEnd

