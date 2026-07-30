/*
 * Game Boy Printer USB Bridge
 *
 * A dedicated USB Serial <-> Game Boy Printer adapter.
 * Unlike GameBoyPrinterEmulator, this sketch never switches to printer
 * emulation mode and does not require the printer to be powered during boot.
 *
 * Serial settings: 9600 baud, 8 data bits, no parity, 1 stop bit.
 *
 * Game Boy link cable at the cable connector:
 *
 *    ___________
 *   |  6  4  2  |
 *    \_5__3__1_/
 *
 * Pin 1: VCC, unused
 * Pin 2: printer serial output -> Arduino input
 * Pin 3: printer serial input  <- Arduino output
 * Pin 4: unused
 * Pin 5: serial clock          <- Arduino output
 * Pin 6: GND
 */

#include <Arduino.h>

#ifdef ESP8266
static const uint8_t GBP_SO_PIN = 13;
static const uint8_t GBP_SI_PIN = 12;
static const uint8_t GBP_SC_PIN = 14;
static const uint8_t LED_STATUS_PIN = 2;
#else
static const uint8_t GBP_SO_PIN = 4;
static const uint8_t GBP_SI_PIN = 3;
static const uint8_t GBP_SC_PIN = 2;
static const uint8_t LED_STATUS_PIN = 13;
#endif

static const unsigned long USB_BAUD_RATE = 9600;
static const unsigned int CLOCK_HALF_PERIOD_US = 30;

uint8_t transferPrinterByte(uint8_t byteSent)
{
  uint8_t byteRead = 0;

  for (uint8_t bitIndex = 0; bitIndex < 8; bitIndex++)
  {
    const bool bitSent = bitRead(byteSent, 7 - bitIndex);

    digitalWrite(GBP_SC_PIN, LOW);
    digitalWrite(GBP_SI_PIN, bitSent ? HIGH : LOW);
    digitalWrite(LED_STATUS_PIN, bitSent ? HIGH : LOW);
    delayMicroseconds(CLOCK_HALF_PERIOD_US);

    digitalWrite(GBP_SC_PIN, HIGH);
    const bool receivedBit = digitalRead(GBP_SO_PIN);
    bitWrite(byteRead, 7 - bitIndex, receivedBit);
    delayMicroseconds(CLOCK_HALF_PERIOD_US);
  }

  return byteRead;
}

void setup()
{
  pinMode(GBP_SC_PIN, OUTPUT);
  pinMode(GBP_SO_PIN, INPUT_PULLUP);
  pinMode(GBP_SI_PIN, OUTPUT);
  pinMode(LED_STATUS_PIN, OUTPUT);

  // Idle levels expected by the Game Boy Printer link interface.
  digitalWrite(GBP_SC_PIN, HIGH);
  digitalWrite(GBP_SI_PIN, LOW);
  digitalWrite(LED_STATUS_PIN, LOW);

  // The bridge is available immediately and never enters emulator mode.
  Serial.begin(USB_BAUD_RATE);
  while (!Serial) { ; }

  while (Serial.available() > 0)
  {
    Serial.read();
  }
}

void loop()
{
  while (Serial.available() > 0)
  {
    const uint8_t byteFromPhone = static_cast<uint8_t>(Serial.read());
    const uint8_t byteFromPrinter = transferPrinterByte(byteFromPhone);
    Serial.write(byteFromPrinter);
  }
}
