# Android Boy Camera

[Русский](#русский) · [English](#english)

Android Boy Camera turns an Android phone into a camera and image editor for the
Nintendo Game Boy Printer. It can prepare authentic four-shade images, create
vertical collages and send print data to a real printer through an Arduino USB
adapter.

> Nintendo, Game Boy and Game Boy Printer are trademarks of their respective
> owners. This is an independent, unofficial project.

## Русский

### Возможности

- Делай фото в стиле камеры Game Boy или обрабатывай уже готовые изображения.
- Четыре способа преобразования в четыре оттенка серого.
- 21 рамка в стиле Game Boy Camera.
- Разные цветовые фильтры.
- Сохранение PNG в галерею Android и отправка изображения в один клик.
- Вертикальные коллажи из фотографий и текстовых блоков.
- Интерфейс на двух языках: русском и английском.
- Печать на реальном Game Boy Printer через Arduino по USB OTG.

### Что нужно для печати

Одного APK недостаточно для физической печати. Необходимо собрать переходник на
Arduino с прошивкой **GameBoyPrinterEmulator** из репозитория
[mofosyne/arduino-gameboy-printer-emulator](https://github.com/mofosyne/arduino-gameboy-printer-emulator).

Телефон подключается к Arduino через USB OTG. Arduino преобразует полученные от
приложения данные в протокол Game Boy Printer и передаёт их принтеру.

### Установка

Скачайте APK со страницы [Releases](https://github.com/DuckWader/Android-Boy-Camera/releases), разрешите установку
приложений из выбранного источника и установите приложение. Для камеры и USB
потребуются соответствующие системные разрешения.

### Исходники и сборка

- `web/` — интерфейс, камера, обработка изображения, коллажи и формирование
  данных печати.
- `android/` — Android WebView, разрешения, USB Serial, сохранение и системная
  отправка PNG.
- `scripts/sync-web.ps1` — собирает веб-интерфейс и переносит результат в
  Android assets.

Для обновления встроенного интерфейса:

```powershell
.\scripts\sync-web.ps1
```

Для сборки debug APK:

```powershell
cd android
.\gradlew.bat assembleDebug
```

Понадобятся JDK 17 и Android SDK.

### Благодарности

Проект вдохновлён приложением
[Mraulio/GBCamera-Android-Manager](https://github.com/Mraulio/GBCamera-Android-Manager).

Поддержка физического принтера основана на совместимости с проектом
[mofosyne/arduino-gameboy-printer-emulator](https://github.com/mofosyne/arduino-gameboy-printer-emulator).

Android Boy Camera разработан **Duck Wader** при помощи нейросетевого
ассистента **OpenAI Codex (GPT-5)**.

---

## English

### Features

- Take photos in the style of the Game Boy Camera or process existing images.
- Four methods for converting images into four shades of gray.
- 21 Game Boy Camera-style frames.
- Various color filters.
- Save PNG images to the Android gallery and share them in one tap.
- Vertical collages made from photos and text blocks.
- Interface available in two languages: Russian and English.
- Print on a real Game Boy Printer through an Arduino connected via USB OTG.

### Hardware required for printing

The APK alone cannot drive the physical printer. Build an Arduino adapter using
the **GameBoyPrinterEmulator** firmware from
[mofosyne/arduino-gameboy-printer-emulator](https://github.com/mofosyne/arduino-gameboy-printer-emulator).

Connect the phone to the Arduino through USB OTG. The Arduino converts the data
sent by the application into the Game Boy Printer protocol and forwards it to
the printer.

### Installation

Download the APK from [Releases](https://github.com/DuckWader/Android-Boy-Camera/releases), allow installation from the
selected source and install it. Android will request camera and USB permissions
when needed.

### Source code and building

- `web/` — UI, camera, image processing, collages and print-data generation.
- `android/` — Android WebView host, permissions, USB Serial, PNG saving and
  native sharing.
- `scripts/sync-web.ps1` — builds the web UI and synchronizes it with Android
  assets.

To update the embedded UI:

```powershell
.\scripts\sync-web.ps1
```

To build a debug APK:

```powershell
cd android
.\gradlew.bat assembleDebug
```

JDK 17 and the Android SDK are required.

### Credits

This project was inspired by
[Mraulio/GBCamera-Android-Manager](https://github.com/Mraulio/GBCamera-Android-Manager).

Physical printer support is designed for compatibility with
[mofosyne/arduino-gameboy-printer-emulator](https://github.com/mofosyne/arduino-gameboy-printer-emulator).

Android Boy Camera was developed by **Duck Wader** with the help of the
**OpenAI Codex (GPT-5)** AI coding assistant.
