@echo off
setlocal enabledelayedexpansion

if "%~1"=="" (
    echo Usage: %0 input.mkv
    exit /b 1
)

set input=%~1
set output="%~dp1%~n1.wav"

echo Extracting audio from %input% to %output%
"E:\ffmpeg-8.1.1-essentials_build\bin\ffmpeg.exe" -i "%input%" -vn -acodec pcm_s16le %output%

if %errorlevel% equ 0 (
    echo Audio extraction completed successfully.
) else (
    echo Error during audio extraction.
)