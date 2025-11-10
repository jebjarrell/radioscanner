import { EventEmitter } from 'node:events';
export class TypedEventEmitter extends EventEmitter {
  on(event, listener) {
    return super.on(event, listener);
  }
  once(event, listener) {
    return super.once(event, listener);
  }
  off(event, listener) {
    return super.off(event, listener);
  }
  emit(event, ...args) {
    return super.emit(event, ...args);
  }
}
