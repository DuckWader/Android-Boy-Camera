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

- Камера телефона с обработкой изображения в реальном времени.
- Основная и зеркально отображаемая фронтальная камера.
- Фиксация кадра повторным нажатием кнопки затвора.
- Импорт фотографий из галереи, выбор области кадрирования и цифровой зум.
- Настройка яркости и контраста.
- Четыре способа преобразования в четыре оттенка:
  - без дизеринга;
  - Bayer 4×4;
  - Floyd–Steinberg;
  - Atkinson.
- 21 рамка в стиле Game Boy Camera.
- Цветовые фильтры для сохранения и отправки изображений. Они не изменяют
  монохромные данные, передаваемые принтеру.
- Сохранение PNG в галерею Android и отправка изображения через системное меню
  «Поделиться».
- Вертикальные коллажи из 1–4 фотографий и текстовых блоков.
- Изменение порядка и удаление элементов коллажа отдельными кнопками.
- Текстовый редактор с предпросмотром, выбором размера и шестью шрифтами,
  поддерживающими кириллицу.
- Русский интерфейс для русской, украинской и белорусской системной локали;
  английский интерфейс для остальных языков.
- Подключение Arduino по USB OTG и передача данных для печати на настоящем
  Game Boy Printer.

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

- Real-time phone camera processing.
- Rear camera and mirrored front camera.
- Tap the shutter again to release a frozen frame.
- Gallery import, crop positioning and digital zoom.
- Brightness and contrast controls.
- Four four-shade conversion modes:
  - no dithering;
  - Bayer 4×4;
  - Floyd–Steinberg;
  - Atkinson.
- 21 Game Boy Camera-style frames.
- Color filters for saving and sharing. They do not change the monochrome data
  sent to the printer.
- Save PNG images to the Android gallery or share them through Android's system
  share sheet.
- Vertical collages containing 1–4 photos and text blocks.
- Dedicated buttons for reordering and deleting collage items.
- Live text preview, adjustable text size and six Cyrillic-capable fonts.
- Russian UI for Russian, Ukrainian and Belarusian system locales; English UI
  for all other locales.
- USB OTG connection to an Arduino and printing on a real Game Boy Printer.

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
