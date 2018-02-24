import { EventEmitter } from '@stencil/core';

export function clamp(min: number, n: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

export function isDef(v: any): boolean { return v !== undefined && v !== null; }

export function isArray(v: any): v is Array<any> { return Array.isArray(v); }

export function isObject(v: any): v is Object { return v !== null && typeof v === 'object'; }

export function isString(v: any): v is (string) { return typeof v === 'string'; }

export function isNumber(v: any): v is (number) { return typeof v === 'number'; }

export function isBlank(val: any): val is null { return val === undefined || val === null; }


export function assert(bool: boolean, msg: string) {
  if (!bool) {
    console.error(msg);
  }
}

export function toDashCase(str: string) {
  return str.replace(/([A-Z])/g, (g) => '-' + g[0].toLowerCase());
}

export function now(ev: UIEvent) {
  return ev.timeStamp || Date.now();
}

export function pointerCoordX(ev: any): number {
  // get X coordinates for either a mouse click
  // or a touch depending on the given event
  if (ev) {
    const changedTouches = ev.changedTouches;
    if (changedTouches && changedTouches.length > 0) {
      return changedTouches[0].clientX;
    }
    if (ev.pageX !== undefined) {
      return ev.pageX;
    }
  }
  return 0;
}

export function updateDetail(ev: any, detail: any) {
  // get X coordinates for either a mouse click
  // or a touch depending on the given event
  let x = 0;
  let y = 0;
  if (ev) {
    const changedTouches = ev.changedTouches;
    if (changedTouches && changedTouches.length > 0) {
      const touch = changedTouches[0];
      x = touch.clientX;
      y = touch.clientY;
    } else if (ev.pageX !== undefined) {
      x = ev.pageX;
      y = ev.pageY;
    }
  }
  detail.currentX = x;
  detail.currentY = y;
}

export function pointerCoordY(ev: any): number {
  // get Y coordinates for either a mouse click
  // or a touch depending on the given event
  if (ev) {
    const changedTouches = ev.changedTouches;
    if (changedTouches && changedTouches.length > 0) {
      return changedTouches[0].clientY;
    }
    if (ev.pageY !== undefined) {
      return ev.pageY;
    }
  }
  return 0;
}

export function applyStyles(el: HTMLElement, styles: {[styleProp: string]: string|number}) {
  const styleProps = Object.keys(styles);

  if (el) {
    for (let i = 0; i < styleProps.length; i++) {
      (el.style as any)[styleProps[i]] = styles[styleProps[i]];
    }
  }
}

/** @hidden */
export type Side = 'left' | 'right' | 'start' | 'end';

export function checkEdgeSide(posX: number, isRightSide: boolean, maxEdgeStart: number): boolean {
  if (isRightSide) {
    return posX >= window.innerWidth - maxEdgeStart;
  } else {
    return posX <= maxEdgeStart;
  }
}

/**
 * @hidden
 * Given a side, return if it should be on the right
 * based on the value of dir
 * @param side the side
 * @param isRTL whether the application dir is rtl
 * @param defaultRight whether the default side is right
 */
export function isRightSide(side: Side, defaultRight = false): boolean {
  const isRTL = document.dir === 'rtl';
  switch (side) {
    case 'right': return true;
    case 'left': return false;
    case 'end': return !isRTL;
    case 'start': return isRTL;
    default: return defaultRight ? !isRTL : isRTL;
  }
}

export function getOrAppendElement(tagName: string): Element {
  const element = document.querySelector(tagName);
  if (element) {
    return element;
  }
  const tmp = document.createElement(tagName);
  document.body.appendChild(tmp);
  return tmp;
}

export function getActiveElement(): HTMLElement {
  return document.activeElement as HTMLElement;
}

export function focusOutActiveElement() {
  const activeElement = getActiveElement();
  activeElement && activeElement.blur && activeElement.blur();
}

export function isTextInput(el: any) {
  return !!el &&
      (el.tagName === 'TEXTAREA'
      || el.contentEditable === 'true'
      || (el.tagName === 'INPUT' && !(NON_TEXT_INPUT_REGEX.test(el.type))));
}
export const NON_TEXT_INPUT_REGEX = /^(radio|checkbox|range|file|submit|reset|color|image|button)$/i;

export function hasFocusedTextInput() {
  const activeElement = getActiveElement();
  if (isTextInput(activeElement) && activeElement.parentElement) {
    return activeElement.parentElement.querySelector(':focus') === activeElement;
  }
  return false;
}

/**
 * @private
 */
export function reorderArray(array: any[], indexes: {from: number, to: number}): any[] {
  const element = array[indexes.from];
  array.splice(indexes.from, 1);
  array.splice(indexes.to, 0, element);
  return array;
}

export function domControllerAsync(domControllerFunction: Function, callback?: Function): Promise<any> {
  return new Promise((resolve) => {
    domControllerFunction(() => {
      if (!callback) {
        return resolve();
      }
      Promise.resolve(callback()).then((...args: any[]) => {
        resolve(args);
      });
    });
  });
}

export function deferEvent(event: EventEmitter): EventEmitter {
  return debounceEvent(event, 0);
}

export function debounceEvent(event: EventEmitter, wait: number): EventEmitter {
  const original = (event as any)._original || event;
  return {
    _original: event,
    emit: debounce(original.emit.bind(original), wait)
  } as EventEmitter;
}

export function debounce(func: Function, wait = 0) {
  let timer: number;
  return (...args: any[]): void => {
    clearTimeout(timer);
    timer = setTimeout(func, wait, ...args);
  };
}

export function asyncRaf(): Promise<number> {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

export function getNavAsChildIfExists(element: HTMLElement): HTMLIonNavElement|null {
  for (let i = 0; i < element.children.length; i++) {
    if (element.children[i].tagName.toLowerCase() === 'ion-nav') {
      return element.children[i] as any as HTMLIonNavElement;
    }
  }
  return null;
}

export function normalizeUrl(url: string): string {
  url = url.trim();
  if (url.charAt(0) !== '/') {
    // ensure first char is a /
    url = '/' + url;
  }
  if (url.length > 1 && url.charAt(url.length - 1) === '/') {
    // ensure last char is not a /
    url = url.substr(0, url.length - 1);
  }
  return url;
}

export function isParentTab(element: HTMLElement) {
  return element.parentElement.tagName.toLowerCase() === 'ion-tab';
}

export function getIonApp(): Promise<HTMLIonAppElement> {
  const appElement = document.querySelector('ion-app');
  if (!appElement) {
    return Promise.resolve(null);
  }
  return appElement.componentOnReady();
}
