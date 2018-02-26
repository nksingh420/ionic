import { AnimationBuilder, Animation, AnimationOptions, Config } from "..";
import { EventEmitter } from "@stencil/core";
import { domControllerAsync } from "./helpers";

let lastId = 1;

/**
 * Convert an interface where all the properties are optional to mandatory.
 */
export type Requires<K extends string> = {
  [P in K]: any;
}

export function createOverlay
<T extends HTMLIonOverlayElement & Requires<keyof B>, B>
(tagName: string, opts: B): Promise<T> {
  // create ionic's wrapping ion-alert component
  const element = document.createElement(tagName) as T;

  // give this alert a unique id
  element.overlayId = lastId++;

  // convert the passed in overlay options into props
  // that get passed down into the new alert
  Object.assign(element, opts);

  // append the alert element to the document body
  const appRoot = document.querySelector('ion-app') || document.body;
  appRoot.appendChild(element);

  return element.componentOnReady();
}

export function dismissOverlay(data: any, role: string, overlays: OverlayMap, id: number): Promise<void> {
  id = id >= 0 ? id : getHighestId(overlays);
  const overlay = overlays.get(id);
  if (!overlay) {
    return Promise.reject('overlay does not exist');
  }
  return overlay.dismiss(data, role);
}

export function getTopOverlay<T extends HTMLIonOverlayElement>(overlays: OverlayMap): T {
  return overlays.get(getHighestId(overlays)) as T;
}

export function getHighestId(overlays: OverlayMap) {
  let minimum = -1;
  overlays.forEach((_, id) => {
    if (id > minimum) {
      minimum = id;
    }
  });
  return minimum;
}

export function removeLastOverlay(overlays: OverlayMap) {
  const toRemove = getTopOverlay(overlays);
  return toRemove ? toRemove.dismiss() : Promise.resolve();
}

export function overlayAnimation(
  overlay: OverlayInterface,
  animationBuilder: AnimationBuilder,
  animate: boolean,
  baseEl: HTMLElement,
  opts: any
): Promise<void> {
  if (overlay.animation) {
    overlay.animation.destroy();
    overlay.animation = null;
  }
  return overlay.animationCtrl.create(animationBuilder, baseEl, opts).then(animation => {
    overlay.animation = animation;
    if (!animate) {
      animation.duration(0);
    }
    return animation.playAsync();
  }).then(animation => {
    animation.destroy();
    overlay.animation = null;
  });
}

export function presentOverlay(
  overlay: OverlayInterface,
  name: string,
  iosEnterAnimation: AnimationBuilder,
  mdEnterAnimation: AnimationBuilder,
  opts: AnimationOptions
) {
  if(overlay.presented) {
    return Promise.reject('overlay already presented');
  }
  overlay.presented = true;
  overlay.willPresent.emit();

  // get the user's animation fn if one was provided
  const animationBuilder = (overlay.enterAnimation)
    ? overlay.enterAnimation
    : overlay.config.get(name, overlay.mode === 'ios' ? iosEnterAnimation : mdEnterAnimation);

  return overlayAnimation(overlay, animationBuilder, overlay.willAnimate, overlay.el, opts).then(() => {
    overlay.didPresent.emit();
  });
}

export function dismiss2Overlay(
  overlay: OverlayInterface,
  data: any,
  role: string,
  iosLeaveAnimation: AnimationBuilder,
  mdLeaveAnimation: AnimationBuilder,
  opts: AnimationOptions
) {
  if(!overlay.presented) {
    return Promise.reject('overlay is not presented');
  }
  overlay.presented = false;

  overlay.willDismiss.emit({data, role});

  const animationBuilder = overlay.leaveAnimation || overlay.config.get('actionSheetLeave', overlay.mode === 'ios' ? iosLeaveAnimation : mdLeaveAnimation);
  return overlayAnimation(overlay, animationBuilder, overlay.willAnimate, overlay.el, opts).then(() => {
    overlay.willDismiss.emit({data, role});

    return domControllerAsync(this.dom.write, () => {
      this.el.parentNode.removeChild(this.el);
    });
  });
}

export function autoFocus(containerEl: HTMLElement): HTMLElement {
  const focusableEls = containerEl.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]');
  if (focusableEls.length > 0) {
    const el = focusableEls[0] as HTMLInputElement;
    el.focus();
    return el;
  }
  return null;
}

export interface OverlayInterface {
  mode: string;
  el: HTMLElement,
  willAnimate: boolean;
  config: Config;
  overlayId: number;
  presented: boolean;
  animation: Animation;
  animationCtrl: HTMLIonAnimationControllerElement;

  enterAnimation: AnimationBuilder;
  leaveAnimation: AnimationBuilder;

  didPresent: EventEmitter;
  willPresent: EventEmitter;
  willDismiss: EventEmitter;
  didDismiss: EventEmitter;

  present(): Promise<void>;
  dismiss(data?: any, role?: string): Promise<void>;
}


export interface HTMLIonOverlayElement extends HTMLStencilElement, OverlayInterface {}

export type OverlayMap = Map<number, HTMLIonOverlayElement>;

export const BACKDROP = 'backdrop';
