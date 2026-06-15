; Soresti Launcher - Custom Installer Branding

; Check for running app before install
!macro customInit
  ExecWait '"TaskKill" /F /IM "Soresti Launcher.exe"'
!macroend

; Custom finish page texts (only if not already defined by electron-builder)
!ifndef MUI_FINISHPAGE_TITLE
  !define MUI_FINISHPAGE_TITLE "Kurulum Tamamlandı"
!endif
!ifndef MUI_FINISHPAGE_TEXT
  !define MUI_FINISHPAGE_TEXT "Soresti Launcher başarıyla kuruldu.$\r$\n$\r$\nProgramı başlatmak için 'Bitir' butonuna tıklayın."
!endif
