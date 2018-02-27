import { ViewController, isViewController } from './view-controller';
import { isArray } from '../../utils/helpers';
import { NavControllerBase } from './nav';
import { Transition } from './transition';


export function getComponent(nameOrPageOrView: any, params?: any): Promise<ViewController> {
  // if (typeof nameOrPageOrView === 'function') {
  //   return Promise.resolve(
  //     new ViewController(nameOrPageOrView, params)
  //   );
  // }
  return Promise.resolve(
    new ViewController(nameOrPageOrView, params)
  );

  // if (typeof nameOrPageOrView === 'string') {
  //   // return linker.getComponentFromName(nameOrPageOrView).then((component) => {
  //   //   const vc = new ViewController(component, params);
  //   //   vc.id = nameOrPageOrView;
  //   //   return vc;
  //   // });
  // }

  // return Promise.resolve(null);
}

export function convertToView(nameOrPageOrView: any, params: any): Promise<ViewController> {
  if (nameOrPageOrView) {
    if (isViewController(nameOrPageOrView)) {
      // is already a ViewController
      return Promise.resolve(<ViewController>nameOrPageOrView);
    }

    return getComponent(nameOrPageOrView, params);
  }

  return Promise.resolve(null);
}

export function convertToViews(pages: any[]): Promise<ViewController[]> {
  const views: Promise<ViewController>[] = [];
  if (isArray(pages)) {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (page) {
        if (isViewController(page)) {
          views.push(page);

        } else if (page.page) {
          views.push(convertToView(page.page, page.params));

        } else {
          views.push(convertToView(page, null));
        }
      }
    }
  }
  return Promise.all(views);
}

let portalZindex = 9999;

export function setZIndex(nav: NavControllerBase, enteringView: ViewController, leavingView: ViewController, direction: string) {
  if (enteringView) {
    if (nav._isPortal) {
      if (direction === DIRECTION_FORWARD) {
        enteringView._setZIndex(nav._zIndexOffset + portalZindex);
      }
      portalZindex++;
      return;
    }

    leavingView = leavingView || nav.getPrevious(enteringView);

    if (leavingView && isPresent(leavingView._zIndex)) {
      if (direction === DIRECTION_BACK) {
        enteringView._setZIndex(leavingView._zIndex - 1);

      } else {
        enteringView._setZIndex(leavingView._zIndex + 1);
      }

    } else {
      enteringView._setZIndex(INIT_ZINDEX + nav._zIndexOffset);
    }
  }
}

export function isTabs(nav: any): boolean {
  // Tabs (ion-tabs)
  return !!nav && !!nav.getSelected;
}

export function isTab(nav: any): boolean {
  // Tab (ion-tab)
  return !!nav && isPresent(nav._tabId);
}

export function isNav(nav: any): boolean {
  // Nav (ion-nav), Tab (ion-tab), Portal (ion-portal)
  return !!nav && !!nav.push && nav.getType() === 'nav';
}

export function linkToSegment(navId: string, type: string, secondaryId: string, link: NavLink): NavSegment {
  const segment = <NavSegment> Object.assign({}, link);
  segment.navId = navId;
  segment.type = type;
  segment.secondaryId = secondaryId;
  return segment;
}


// internal link interface, not exposed publicly
export interface NavLink {
  component?: any;
  loadChildren?: string;
  name?: string;
  segment?: string;
  segmentParts?: string[];
  segmentPartsLen?: number;
  staticLen?: number;
  dataLen?: number;
  dataKeys?: {[key: string]: boolean};
  defaultHistory?: any[];
}

export interface NavResult {
  hasCompleted: boolean;
  requiresTransition: boolean;
  enteringName?: string;
  leavingName?: string;
  direction?: string;
}

export interface NavSegment extends DehydratedSegment {
  type: string;
  navId: string;
  secondaryId: string;
  requiresExplicitNavPrefix?: boolean;
}

export interface DehydratedSegment {
  id: string;
  name: string;
  component?: any;
  loadChildren?: string;
  data: any;
  defaultHistory?: NavSegment[];
  secondaryId?: string;
}

export interface DehydratedSegmentPair {
  segments: DehydratedSegment[];
  navGroup: NavGroup;
}

export interface NavGroup {
  type: string;
  navId: string;
  secondaryId: string;
  segmentPieces?: string[];
  tabSegmentPieces?: string[];
}

export interface NavOptions {
  animate?: boolean;
  animation?: string;
  direction?: string;
  duration?: number;
  easing?: string;
  id?: string;
  keyboardClose?: boolean;
  progressAnimation?: boolean;
  disableApp?: boolean;
  minClickBlockDuration?: number;
  ev?: any;
  updateUrl?: boolean;
  isNavRoot?: boolean;
}

export function isPresent(val: any): val is any { return val !== undefined && val !== null; }

export interface Page extends Function {
  new (...args: any[]): any;
}

export interface TransitionResolveFn {
  (hasCompleted: boolean, requiresTransition: boolean, enteringName?: string, leavingName?: string, direction?: string): void;
}

export interface TransitionRejectFn {
  (rejectReason: any, transition?: Transition): void;
}

export interface TransitionDoneFn {
  (hasCompleted: boolean, requiresTransition: boolean, enteringName?: string, leavingName?: string, direction?: string): void;
}

export interface TransitionInstruction {
  opts: NavOptions;
  insertStart?: number;
  insertViews?: any[];
  removeView?: ViewController;
  removeStart?: number;
  removeCount?: number;
  resolve?: (hasCompleted: boolean) => void;
  reject?: (rejectReason: string) => void;
  done?: TransitionDoneFn;
  leavingRequiresTransition?: boolean;
  enteringRequiresTransition?: boolean;
  requiresTransition?: boolean;
}

export const STATE_NEW = 1;
export const STATE_INITIALIZED = 2;
export const STATE_ATTACHED = 3;
export const STATE_DESTROYED = 4;

export const INIT_ZINDEX = 100;

export const DIRECTION_BACK = 'back';
export const DIRECTION_FORWARD = 'forward';
export const DIRECTION_SWITCH = 'switch';

export const NAV = 'nav';
export const TABS = 'tabs';
