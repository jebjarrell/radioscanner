import { EventEmitter } from 'node:events';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Typed listeners accept strongly typed arguments downstream.
type Listener = (...args: any[]) => void;
type EventKey<T> = Extract<keyof T, string | symbol>;

export class TypedEventEmitter<TEvents extends Record<string, Listener>> extends EventEmitter {
  on<TEvent extends EventKey<TEvents>>(event: TEvent, listener: TEvents[TEvent]): this;
  on(event: string | symbol, listener: Listener): this {
    return super.on(event, listener);
  }

  once<TEvent extends EventKey<TEvents>>(event: TEvent, listener: TEvents[TEvent]): this;
  once(event: string | symbol, listener: Listener): this {
    return super.once(event, listener);
  }

  off<TEvent extends EventKey<TEvents>>(event: TEvent, listener: TEvents[TEvent]): this;
  off(event: string | symbol, listener: Listener): this {
    return super.off(event, listener);
  }

  emit<TEvent extends EventKey<TEvents>>(
    event: TEvent,
    ...args: Parameters<TEvents[TEvent]>
  ): boolean;
  emit(event: string | symbol, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }
}
