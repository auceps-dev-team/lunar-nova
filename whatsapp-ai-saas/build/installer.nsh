; Custom Uninstall Hook
; Only open the uninstall feedback page if it is a REAL uninstall,
; NOT a silent background uninstall triggered by an auto-update.
;
; electron-builder passes /UPDATE on the command line when it is
; replacing a previous version. We detect that flag and skip the URL.

!macro customUnInstall
  ; Read the command-line arguments for this uninstaller process
  ${GetParameters} $R0

  ; Check if /UPDATE was passed (set automatically by electron-builder during updates)
  ${GetOptions} $R0 "/UPDATE" $R1
  IfErrors 0 +2          ; If no error → /UPDATE flag IS present → jump over the URL
    ; NB : le slug « unistall » est volontaire — c'est la page réellement publiée
    ; côté site (la variante corrigée « uninstall » renvoie 404).
    ExecShell "" "https://auceps-digital.agency/unistall-wacopilote/"
!macroend
