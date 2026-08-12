@echo off
REM print-pack.bat — Double-click de dong goi bo cai dat cau in cho quan.
REM Chi la vo boc goi print-pack.ps1, de khong phai go lenh PowerShell.
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0print-pack.ps1" %*
