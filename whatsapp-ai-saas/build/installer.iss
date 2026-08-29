; ============================================================
;  WaCopilote - Inno Setup Script
;  Génère un installateur EXE depuis le dossier win-unpacked
; ============================================================

#define AppName      "WaCopilote"
#define AppVersion   "1.46.1"
#define AppPublisher "Auceps Digital"
#define AppURL       "https://auceps-digital.agency"
#define AppExeName   "WaCopilote.exe"
#define SourceDir    "..\dist-electron\win-unpacked"
#define OutputDir    "..\dist-electron"
#define LicenseFile  "license.txt"
#define SetupIcon    "..\public\assets\WaCopilot Logo.ico"

[Setup]
; Identifiant unique de l'application (ne pas changer entre versions)
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
AllowNoIcons=yes
LicenseFile={#LicenseFile}
OutputDir={#OutputDir}
OutputBaseFilename={#AppName} {#AppVersion}
SetupIconFile={#SetupIcon}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesInstallIn64BitMode=x64compatible
DisableDirPage=no
DisableProgramGroupPage=yes

[Languages]
Name: "french";  MessagesFile: "compiler:Languages\French.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Copier tout le contenu du dossier win-unpacked
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Raccourci dans le menu Démarrer
Name: "{group}\{#AppName}";              Filename: "{app}\{#AppExeName}"
Name: "{group}\Désinstaller {#AppName}"; Filename: "{uninstallexe}"
; Raccourci sur le Bureau (optionnel)
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
; Lancer l'app après installation
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(AppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Ouvrir page de feedback à la désinstallation
; NB : le slug « unistall » est volontaire — c'est la page réellement publiée
; côté site (la variante corrigée « uninstall » renvoie 404). Ne pas « corriger ».
Filename: "{cmd}"; Parameters: "/c start https://auceps-digital.agency/unistall-wacopilote/"; Flags: runhidden; RunOnceId: "UninstallFeedback"

[Code]
// Vérifier si une version précédente est installée et proposer de la désinstaller
function InitializeSetup(): Boolean;
var
  UninstallKey: String;
  UninstallExe: String;
  ResultCode: Integer;
begin
  Result := True;
  UninstallKey := 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}_is1';
  if RegQueryStringValue(HKLM, UninstallKey, 'UninstallString', UninstallExe) or
     RegQueryStringValue(HKCU, UninstallKey, 'UninstallString', UninstallExe) then
  begin
    if MsgBox('Une version précédente de WaCopilote est détectée. Voulez-vous la désinstaller avant de continuer ?',
              mbConfirmation, MB_YESNO) = IDYES then
    begin
      Exec(RemoveQuotes(UninstallExe), '/SILENT', '', SW_SHOW, ewWaitUntilTerminated, ResultCode);
    end;
  end;
end;
