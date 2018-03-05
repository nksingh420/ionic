
import { NavOptions, STATE_ATTACHED, STATE_DESTROYED, STATE_INITIALIZED, STATE_NEW } from './nav-util';
import { NavControllerBase } from './nav';
import { assert } from '../../utils/helpers';

/**
 * @name ViewController
 * @description
 * Access various features and information about the current view.
 * @usage
 *  ```ts
 * import { Component } from '@angular/core';
 * import { ViewController } from 'ionic-angular';
 *
 * @Component({...})
 * export class MyPage{
 *
 *   constructor(public viewCtrl: ViewController) {}
 *
 * }
 * ```
 */
export class ViewController {

  private _cntDir: any;
  private _isHidden = false;
  private _leavingOpts: NavOptions;
  private _onDidDismiss: Function;
  private _onWillDismiss: Function;
  private _dismissData: any;
  private _dismissRole: any;
  private _detached: boolean;

  _nav: NavControllerBase;
  _zIndex: number;
  _state: number = STATE_NEW;
  _cssClass: string;

  /**
   * Observable to be subscribed to when the current component will become active
   * @returns {Observable} Returns an observable
   */
  // willEnter: EventEmitter<any> = new EventEmitter();

  // /**
  //  * Observable to be subscribed to when the current component has become active
  //  * @returns {Observable} Returns an observable
  //  */
  // didEnter: EventEmitter<any> = new EventEmitter();

  // /**
  //  * Observable to be subscribed to when the current component will no longer be active
  //  * @returns {Observable} Returns an observable
  //  */
  // willLeave: EventEmitter<any> = new EventEmitter();

  // /**
  //  * Observable to be subscribed to when the current component is no long active
  //  * @returns {Observable} Returns an observable
  //  */
  // didLeave: EventEmitter<any> = new EventEmitter();

  // /**
  //  * Observable to be subscribed to when the current component has been destroyed
  //  * @returns {Observable} Returns an observable
  //  */
  // willUnload: EventEmitter<any> = new EventEmitter();

  // /**
  //  * @hidden
  //  */
  // readReady: EventEmitter<any> = new EventEmitter<any>();

  // /**
  //  * @hidden
  //  */
  // writeReady: EventEmitter<any> = new EventEmitter<any>();

  /** @hidden */
  // data: any;

  /** @hidden */
  id: string;

  /** @hidden */
  isOverlay = false;

  element: HTMLElement;
  /** @hidden */
  // @Output() private _emitter: EventEmitter<any> = new EventEmitter();

  constructor(
    public component: any,
    public data?: any,
    rootCssClass: string = DEFAULT_CSS_CLASS
  ) {
    // component could be anything, never use it directly
    // it could be a string, a HTMLElement
    // passed in data could be NavParams, but all we care about is its data object
    // this.data = (data instanceof NavParams ? data.data : (isPresent(data) ? data : {}));
    this._cssClass = rootCssClass;
  }

  /**
   * @hidden
   */
  init() {
    if (this.element) {
      return;
    }
    const component = this.component;
    this.element = (typeof component === 'string')
      ? document.createElement(component)
      : component;
  }

  _setNav(navCtrl: NavControllerBase) {
    this._nav = navCtrl;
  }


  // /**
  //  * @hidden
  //  */
  // subscribe(generatorOrNext?: any): any {
  //   return this._emitter.subscribe(generatorOrNext);
  // }

  // /**
  //  * @hidden
  //  */
  // emit(data?: any) {
  //   this._emitter.emit(data);
  // }

  /**
   * Called when the current viewController has be successfully dismissed
   */
  onDidDismiss(callback: Function) {
    this._onDidDismiss = callback;
  }

  /**
   * Called when the current viewController will be dismissed
   */
  onWillDismiss(callback: Function) {
    this._onWillDismiss = callback;
  }

  /**
   * Dismiss the current viewController
   * @param {any} [data] Data that you want to return when the viewController is dismissed.
   * @param {any} [role ]
   * @param {NavOptions} NavOptions Options for the dismiss navigation.
   * @returns {any} data Returns the data passed in, if any.
   */
  dismiss(data?: any, role?: any, navOptions: NavOptions = {}): Promise<any> {
    if (!this._nav) {
      assert(this._state === STATE_DESTROYED, 'ViewController does not have a valid _nav');
      return Promise.resolve(false);
    }
    if (this.isOverlay && !navOptions.minClickBlockDuration) {
      // This is a Modal being dismissed so we need
      // to add the minClickBlockDuration option
      // for UIWebView
      navOptions.minClickBlockDuration = 400;
    }
    this._dismissData = data;
    this._dismissRole = role;

    const options = Object.assign({}, this._leavingOpts, navOptions);
    return this._nav.removeView(this, options).then(() => data);
  }

  /**
   * @hidden
   */
  getNav(): NavControllerBase {
    return this._nav;
  }

  /**
   * @hidden
   */
  getTransitionName(_direction: string): string {
    return this._nav && this._nav.config && this._nav.config.get('pageTransition') || 'md';
  }

  // /**
  //  * @hidden
  //  */
  // getNavParams(): NavParams {
  //   return new NavParams(this.data);
  // }

  /**
   * @hidden
   */
  setLeavingOpts(opts: NavOptions) {
    this._leavingOpts = opts;
  }

  /**
   * Check to see if you can go back in the navigation stack.
   * @returns {boolean} Returns if it's possible to go back from this Page.
   */
  enableBack(): boolean {
    // update if it's possible to go back from this nav item
    if (!this._nav) {
      return false;
    }
    // the previous view may exist, but if it's about to be destroyed
    // it shouldn't be able to go back to
    const previousItem = this._nav.getPrevious(this);
    return !!(previousItem);
  }

  /**
   * @hidden
   */
  get name(): string {
    const component = this.component;
    if (typeof component === 'string') {
      return component;
    }
    if (component.tagName) {
      return component.tagName;
    }
    return this.element ? this.element.tagName : 'unknown';
  }

  /**
   * Get the index of the current component in the current navigation stack.
   * @returns {number} Returns the index of this page within its `NavController`.
   */
  get index(): number {
    return (this._nav ? this._nav.indexOf(this) : -1);
  }

  /**
   * @returns {boolean} Returns if this Page is the first in the stack of pages within its NavController.
   */
  isFirst(): boolean {
    return (this._nav ? this._nav.first() === this : false);
  }

  /**
   * @returns {boolean} Returns if this Page is the last in the stack of pages within its NavController.
   */
  isLast(): boolean {
    return (this._nav ? this._nav.last() === this : false);
  }

  /**
   * @hidden
   * DOM WRITE
   */
  _domShow(shouldShow: boolean) {
    // using hidden element attribute to display:none and not render views
    // doing checks to make sure we only update the DOM when actually needed
    // if it should render, then the hidden attribute should not be on the element
    if (this.element && shouldShow === this._isHidden) {
      this._isHidden = !shouldShow;

      // ******** DOM WRITE ****************
      if (shouldShow) {
        this.element.removeAttribute('hidden');
      } else {
        this.element.setAttribute('hidden', '');
      }

    }
  }

  /**
   * @hidden
   */
  getZIndex(): number {
    return this._zIndex;
  }

  /**
   * @hidden
   * DOM WRITE
   */
  _setZIndex(zIndex: number) {
    if (zIndex !== this._zIndex) {
      this._zIndex = zIndex;
      const pageEl = this.element;
      if (pageEl) {
        const el = pageEl as HTMLElement;
        // ******** DOM WRITE ****************
        el.style.zIndex = zIndex + '';
      }
    }
  }

  /**
   * Change the title of the back-button. Be sure to call this
   * after `ionViewWillEnter` to make sure the  DOM has been rendered.
   * @param {string} backButtonText Set the back button text.
   */
  // setBackButtonText(val: string) {
  //   this._nb && this._nb.setBackButtonText(val);
  // }

  /**
   * Set if the back button for the current view is visible or not. Be sure to call this
   * after `ionViewWillEnter` to make sure the  DOM has been rendered.
   * @param {boolean} Set if this Page's back button should show or not.
   */
  // showBackButton(shouldShow: boolean) {
  //   if (this._nb) {
  //     this._nb.hideBackButton = !shouldShow;
  //   }
  // }

  _preLoad() {
    assert(this._state === STATE_INITIALIZED, 'view state must be INITIALIZED');
    this._lifecycle('PreLoad');
  }

  /**
   * @hidden
   * The view has loaded. This event only happens once per view will be created.
   * This event is fired before the component and his children have been initialized.
   */
  _willLoad() {
    assert(this._state === STATE_INITIALIZED, 'view state must be INITIALIZED');
    this._lifecycle('WillLoad');
  }

  /**
   * @hidden
   * The view has loaded. This event only happens once per view being
   * created. If a view leaves but is cached, then this will not
   * fire again on a subsequent viewing. This method is a good place
   * to put your setup code for the view; however, it is not the
   * recommended method to use when a view becomes active.
   */
  _didLoad() {
    assert(this._state === STATE_ATTACHED, 'view state must be ATTACHED');
    this._lifecycle('DidLoad');
  }

  /**
   * @hidden
   * The view is about to enter and become the active view.
   */
  _willEnter() {
    assert(this._state === STATE_ATTACHED, 'view state must be ATTACHED');

    if (this._detached) {
      // ensure this has been re-attached to the change detector
      // TODO
      // this._cmp.changeDetectorRef.reattach();
      this._detached = false;
    }

    // this.willEnter.emit(null);
    this._lifecycle('WillEnter');
  }

  /**
   * @hidden
   * The view has fully entered and is now the active view. This
   * will fire, whether it was the first load or loaded from the cache.
   */
  _didEnter() {
    assert(this._state === STATE_ATTACHED, 'view state must be ATTACHED');

    // this._nb && this._nb.didEnter();
    // this.didEnter.emit(null);
    this._lifecycle('DidEnter');
  }

  /**
   * @hidden
   * The view is about to leave and no longer be the active view.
   */
  _willLeave(willUnload: boolean) {
    // this.willLeave.emit(null);
    this._lifecycle('WillLeave');

    if (willUnload && this._onWillDismiss) {
      this._onWillDismiss(this._dismissData, this._dismissRole);
      this._onWillDismiss = null;
    }
  }

  /**
   * @hidden
   * The view has finished leaving and is no longer the active view. This
   * will fire, whether it is cached or unloaded.
   */
  _didLeave() {
    // this.didLeave.emit(null);
    this._lifecycle('DidLeave');

    // when this is not the active page
    // we no longer need to detect changes
    if (!this._detached) {
      // TODO
      // this._cmp.changeDetectorRef.detach();
      this._detached = true;
    }
  }

  /**
   * @hidden
   */
  _willUnload() {
    // this.willUnload.emit(null);
    this._lifecycle('WillUnload');

    this._onDidDismiss && this._onDidDismiss(this._dismissData, this._dismissRole);
    this._onDidDismiss = null;
    this._dismissData = null;
    this._dismissRole = null;
  }

  /**
   * @hidden
   * DOM WRITE
   */
  _destroy() {
    assert(this._state !== STATE_DESTROYED, 'view state must be ATTACHED');

    const element = this.element;
    if (element) {
      // completely destroy this component. boom.
      // TODO
      // this._cmp.destroy();
      element.remove();
    }

    this._nav = this._cntDir = this._leavingOpts = this._onDidDismiss = this._onWillDismiss = null;
    this._state = STATE_DESTROYED;
  }

  /**
   * @hidden
   */
  _lifecycleTest(_lifecycle: string): Promise<any> {
    // const instance = this.instance;
    // const methodName = 'ionViewCan' + lifecycle;
    // if (instance && instance[methodName]) {
    //   try {
    //     const result = instance[methodName]();
    //     if (result instanceof Promise) {
    //       return result;
    //     } else {
    //       // Any value but explitic false, should be true
    //       return Promise.resolve(result !== false);
    //     }

    //   } catch (e) {
    //     return Promise.reject(`${this.name} ${methodName} error: ${e.message}`);
    //   }
    // }
    return Promise.resolve(true);
  }

  _lifecycle(_lifecycle: string) {
    // const event = new CustomEvent(`ionView${lifecycle}`, {
    //   bubbles: false,
    //   cancelable: false
    // });
    // this.element.dispatchEvent(event);
  }

}

export function isViewController(viewCtrl: any): viewCtrl is ViewController {
  return !!(viewCtrl && (<ViewController>viewCtrl)._didLoad && (<ViewController>viewCtrl)._willUnload);
}

const DEFAULT_CSS_CLASS = 'ion-page';
