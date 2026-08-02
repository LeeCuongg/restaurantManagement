@echo off
REM print-setup.bat — Double-click de cai dat may in cho quan.
REM Chi la vo boc goi print-setup.ps1, de nguoi cai khong phai go lenh PowerShell.
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0print-setup.ps1"
