@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" http://localhost:4173
npm.cmd run preview
