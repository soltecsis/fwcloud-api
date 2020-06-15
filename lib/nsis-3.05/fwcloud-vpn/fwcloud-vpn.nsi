!include 'WinVer.nsh'
#!include 'LogicLib.nsh'
#!include 'GetWindowsVersion.nsh'
!include "MUI2.nsh"

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
!define CONFIG_FILE "config.ovpn"

!define INSTALL_DIR "$PROGRAMFILES64\${APP_NAME}"
!define INSTALL_TYPE "SetShellVarContext all"
!define REG_ROOT "HKLM"
!define REG_APP_PATH "Software\Microsoft\Windows\CurrentVersion\App Paths\${MAIN_APP_EXE}"
!define UNINSTALL_PATH "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
!define REG_START_MENU "Start Menu Folder"

var SM_Folder
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
InstallDirRegKey "${REG_ROOT}" "${REG_APP_PATH}" ""
InstallDir "${INSTALL_DIR}"

######################################################################

!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_WELCOMEFINISHPAGE_BITMAP "${BANNER}"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "${BANNER}"

######################################################################
!define MUI_FINISHPAGE_SHOWREADME
#!define MUI_FINISHPAGE_SHOWREADME_TEXT "Visit our Web site for more information"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION "LaunchWeb"

!define MUI_FINISHPAGE_RUN
#!define MUI_FINISHPAGE_RUN_TEXT "Run OpenVPN GUI"
!define MUI_FINISHPAGE_RUN_FUNCTION "LaunchApp"

!define MUI_FINISHPAGE_LINK "FWCloud VPN Website"
!define MUI_FINISHPAGE_LINK_LOCATION ${WEB_SITE}

Function LaunchWeb
	ExecShell "open" "${WEB_SITE}" SW_SHOWNORMAL
FunctionEnd

Function LaunchApp
	ExecShell "" "$InstDir\VPN\bin\openvpn-gui.exe"
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

;Languages
!insertmacro MUI_LANGUAGE "English" ; The first language is the default language
!insertmacro MUI_LANGUAGE "Spanish"
!insertmacro MUI_LANGUAGE "French"
!insertmacro MUI_LANGUAGE "German"

######################################################################

Function .onInit
	!insertmacro MUI_LANGDLL_DISPLAY
FunctionEnd

Section -MainProgram
	${INSTALL_TYPE}

	SetOverwrite ifnewer
	SetOutPath "$INSTDIR"

        FileOpen $0 launcher.bat w
        FileWrite $0 "VPN\opengui-fwcloud.exe /S /D=$InstDir\VPN$\r$\n"
        FileWrite $0 "exit$\r$\n"
        FileClose $0
	File /r /x *.nsi /x ${INSTALLER_NAME} ".\\"

	;${GetWindowsVersion} $R0
	;MessageBox MB_OK|MB_ICONEXCLAMATION "his ----- version is $R0"
	;${If} $R0 == "10.0"

	${If} ${AtLeastWin10}
		MessageBox MB_OK|MB_ICONEXCLAMATION "Entro en Win 10"
		Rename $InstDir\OpenVPN-versions\openvpn-install-2.4.9-I601-Win10.exe $InstDir\VPN\opengui-fwcloud.exe
	${ElseIf} ${AtLeastWin7}
		MessageBox MB_OK|MB_ICONEXCLAMATION "Entro en Win 7"
		Rename $InstDir\OpenVPN-versions\openvpn-install-2.4.9-I601-Win7.exe $InstDir\VPN\opengui-fwcloud.exe
	${Else}
		MessageBox MB_OK|MB_ICONEXCLAMATION "Sorry, but your Windows version is unsupported. Windows 7 or above is required"
		abort
	${EndIf}

	ExecShellWait "" "launcher.bat" "" SW_HIDE


SectionEnd

	Function .onInstSuccess
		Delete $InstDir\launcher.bat
		Delete $InstDir\banner.bmp
		Delete $InstDir\fwcloud-vpn.nsi
		Delete $InstDir\VPN\opengui-fwcloud.exe
		RmDir /r $InstDir\OpenVPN-versions
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

ExecWait '"$InstDir\VPN\Uninstall.exe" /S' $1

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

#!finalize 'sing.bat "%1" "${COMP_NAME}" ${WEB_SITE}'

