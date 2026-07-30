const useRussian = /^(ru|uk|be)(-|$)/i.test(navigator.language || "");
const tr = (ru, en) => useRussian ? ru : en;

class AndroidUsbSerial {
  constructor() {
    this.device = null;
    this.interfaceNumber = 0;
    this.endpointOut = 0;
    this.endpointIn = 0;
  }

  async connect() {
    this.device = await navigator.usb.requestDevice({
      filters: [
        { vendorId: 0x1a86, productId: 0x7523 },
        { vendorId: 0x10c4, productId: 0xea60 },
      ],
    });
    await this.device.open();
    if (!this.device.configuration) await this.device.selectConfiguration(1);
    const iface = this.device.configuration.interfaces.find((item) =>
      item.alternates.some((alt) =>
        alt.endpoints.some((ep) => ep.direction === "out" && ep.type === "bulk")));
    if (!iface) throw new Error(tr("У USB-адаптера не найден канал передачи", "No output channel was found on the USB adapter"));
    this.interfaceNumber = iface.interfaceNumber;
    const alt = iface.alternates.find((item) => item.endpoints.length) || iface.alternates[0];
    this.endpointOut = alt.endpoints.find((ep) => ep.direction === "out" && ep.type === "bulk")?.endpointNumber;
    this.endpointIn = alt.endpoints.find((ep) => ep.direction === "in" && ep.type === "bulk")?.endpointNumber;
    if (!this.endpointIn) throw new Error(tr("У USB-адаптера не найден канал ответа", "No input channel was found on the USB adapter"));
    await this.device.claimInterface(this.interfaceNumber);
    if (alt.alternateSetting) await this.device.selectAlternateInterface(this.interfaceNumber, alt.alternateSetting);
    if (this.device.vendorId === 0x1a86) await this.initCh340();
    else await this.initCp210x();
  }

  control(request, value, index = 0, data) {
    return this.device.controlTransferOut({
      requestType: "vendor", recipient: "device", request, value, index,
    }, data);
  }

  async initCh340() {
    const empty = new Uint8Array([0]);
    await this.control(0xa1, 0xc29c, 0xb2b9, empty);
    await this.control(0xa4, 0x00df);
    await this.control(0xa4, 0x009f);
    await this.control(0x9a, 0x2727, 0, empty);
    await this.control(0x9a, 0x1312, 0xb282, empty);
    await this.control(0x9a, 0x0f2c, 0x0008, empty);
    await this.control(0x9a, 0x2518, 0x00c3, empty);
    await this.control(0x9a, 0x2727, 0, empty);
  }

  async initCp210x() {
    await this.control(0x00, 0x0001, this.interfaceNumber);
    await this.control(0x1e, 0, this.interfaceNumber, new Uint8Array([0x80, 0x25, 0x00, 0x00]));
    await this.control(0x03, 0x0800, this.interfaceNumber);
  }

  async write(bytes) {
    const result = await this.device.transferOut(this.endpointOut, bytes);
    if (result.status !== "ok") throw new Error(`USB: ${result.status}`);
  }

  async exchange(bytes, timeout = 1500) {
    await this.write(bytes);
    const output = new Uint8Array(bytes.length);
    let offset = 0;
    const deadline = Date.now() + timeout;
    while (offset < output.length && Date.now() < deadline) {
      const result = await this.device.transferIn(this.endpointIn, output.length - offset);
      if (result.status !== "ok") throw new Error(`USB: ${result.status}`);
      const chunk = new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
      output.set(chunk.slice(0, output.length - offset), offset);
      offset += chunk.length;
    }
    if (offset < output.length) throw new Error(tr("Принтер не ответил вовремя", "Printer response timed out"));
    return output;
  }

  async disconnect() {
    if (!this.device) return;
    await this.device.releaseInterface(this.interfaceNumber).catch(() => {});
    await this.device.close();
    this.device = null;
  }
}

export class PrinterTransport {
  constructor() {
    this.port = null;
    this.writer = null;
    this.reader = null;
    this.mode = null;
    this.rxQueue = [];
    this.rxWaiters = [];
    this.readLoopActive = false;
  }

  get supported() {
    return Boolean(window.AndroidBridge || navigator.serial || navigator.usb);
  }

  async connect({ auto = false } = {}) {
    if (this.port) return this.mode;
    if (window.AndroidBridge) {
      let result = window.AndroidBridge.connectUsb();
      if (result === "PENDING") {
        result = await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(tr("Истекло время ожидания разрешения USB", "USB permission request timed out")), 30000);
          window.__androidUsbResult = (value) => {
            clearTimeout(timeout);
            delete window.__androidUsbResult;
            resolve(value);
          };
        });
      }
      if (result !== "READY") throw new Error(result);
      this.mode = "Android USB";
      this.port = window.AndroidBridge;
    } else if (navigator.serial) {
      this.mode = "Web Serial";
      if (auto) {
        const ports = await navigator.serial.getPorts();
        if (!ports.length) throw new Error("NO_AUTHORIZED_PORT");
        this.port = ports[0];
      } else {
        this.port = await navigator.serial.requestPort();
      }
      await this.port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none", flowControl: "none" });
      this.writer = this.port.writable.getWriter();
      this.reader = this.port.readable.getReader();
      this.readLoopActive = true;
      this.readLoop();
    } else if (navigator.usb) {
      this.mode = "WebUSB";
      this.port = new AndroidUsbSerial();
      await this.port.connect();
    } else {
      throw new Error(tr("В этом браузере нет Web Serial или WebUSB", "This browser does not support Web Serial or WebUSB"));
    }
    return this.mode;
  }

  async write(bytes) {
    if (!this.port) throw new Error(tr("Arduino не подключена", "Arduino is not connected"));
    if (window.AndroidBridge && this.port === window.AndroidBridge) {
      const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
      const result = window.AndroidBridge.writeUsb(btoa(binary));
      if (result !== "OK") throw new Error(result);
    } else if (this.writer) await this.writer.write(bytes);
    else await this.port.write(bytes);
  }

  async readLoop() {
    try {
      while (this.readLoopActive && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          this.rxQueue.push(...value);
          this.rxWaiters.splice(0).forEach((resolve) => resolve());
        }
      }
    } catch {
      // Disconnects and released ports terminate the background reader.
    } finally {
      this.readLoopActive = false;
      this.rxWaiters.splice(0).forEach((resolve) => resolve());
    }
  }

  clearInput() {
    this.rxQueue.length = 0;
  }

  async readExact(length, timeout = 1500) {
    const deadline = Date.now() + timeout;
    while (this.rxQueue.length < length) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error(tr("Принтер не ответил вовремя", "Printer response timed out"));
      await new Promise((resolve) => {
        let settled = false;
        const waiter = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          const index = this.rxWaiters.indexOf(waiter);
          if (index >= 0) this.rxWaiters.splice(index, 1);
          resolve();
        }, remaining);
        this.rxWaiters.push(waiter);
      });
    }
    return new Uint8Array(this.rxQueue.splice(0, length));
  }

  async exchange(bytes, timeout = 1500) {
    if (window.AndroidBridge && this.port === window.AndroidBridge) {
      if (!window.AndroidBridge.exchangeUsb) {
        throw new Error(tr("Эта версия Android-приложения не умеет читать ответ принтера", "This Android app version cannot read printer responses"));
      }
      const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
      const result = window.AndroidBridge.exchangeUsb(btoa(binary), timeout);
      if (result.startsWith("ERROR:")) throw new Error(result.slice(6));
      const decoded = atob(result);
      return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
    }
    if (this.writer) {
      await this.writer.write(bytes);
      return this.readExact(bytes.length, timeout);
    }
    if (typeof this.port.exchange === "function") return this.port.exchange(bytes, timeout);
    throw new Error(tr("Чтение ответа пока недоступно для этого подключения", "Response reading is unavailable for this connection"));
  }

  async autoConnect() {
    if (this.port) return null;
    if (window.AndroidBridge) return this.connect({ auto: true });
    if (!navigator.serial) return null;
    try {
      return await this.connect({ auto: true });
    } catch (error) {
      if (error.message === "NO_AUTHORIZED_PORT") return null;
      throw error;
    }
  }

  async recoverPrinter() {
    if (!window.AndroidBridge || this.port !== window.AndroidBridge || !window.AndroidBridge.restartUsb) {
      return false;
    }
    const result = window.AndroidBridge.restartUsb();
    if (result !== "READY") return false;
    return true;
  }

  async isConnected() {
    if (!this.port) return false;
    if (window.AndroidBridge && this.port === window.AndroidBridge && window.AndroidBridge.isUsbConnected) {
      return Boolean(window.AndroidBridge.isUsbConnected());
    }
    return true;
  }

  async disconnect() {
    if (!this.port) return;
    try {
      if (window.AndroidBridge && this.port === window.AndroidBridge) {
        window.AndroidBridge.disconnectUsb();
      } else if (this.writer) {
        this.readLoopActive = false;
        await this.reader?.cancel().catch(() => {});
        this.reader?.releaseLock();
        this.reader = null;
        this.writer.releaseLock();
        await this.port.close();
      } else {
        await this.port.disconnect();
      }
    } finally {
      this.writer = null;
      this.reader = null;
      this.port = null;
      this.mode = null;
      this.rxQueue.length = 0;
    }
  }
}
