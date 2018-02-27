import {
  DIRECTION_BACK,
  DIRECTION_FORWARD,
  INIT_ZINDEX,
  NavOptions,
  NavResult,
  STATE_ATTACHED,
  STATE_DESTROYED,
  STATE_INITIALIZED,
  STATE_NEW,
  TransitionDoneFn,
  TransitionInstruction,
  convertToViews,
  isPresent,
  setZIndex
} from './nav-util';

// import { DomFrameworkDelegate } from '../../utils/dom-framework-delegate';
// import { DomRouterDelegate } from '../../utils/dom-router-delegate';


import { ViewController, isViewController } from './view-controller';
// import { NavigationContainer } from './navigation-container';
// import { NavController } from './nav-controller';
// import { NavParams } from './nav-params';
// import { Platform } from '../platform/platform';
// import { Transition } from '../transitions/transition';
// import { TransitionController } from '../transitions/transition-controller';
import { Component, Element, Event, EventEmitter, Method, Prop } from '@stencil/core';
import { AnimationOptions, Config, DomController, FrameworkDelegate, GestureDetail, RouterDelegate } from '../..';
import { assert, isBlank, isNumber } from '../../utils/helpers';


import { TransitionController } from './transition-controller';
import { Transition } from './transition';


import iosTransitionAnimation from './animations/ios.transition';
// import mdTransitionAnimation from './animations/md.transition';

const TrnsCtrl = new TransitionController();
/**
 * @hidden
 * This class is for internal use only. It is not exported publicly.
 */
@Component({
  tag: 'ion-nav'
})
export class NavControllerBase {

  _children: NavControllerBase[];
  _ids = -1;
  _init = false;
  _isPortal: boolean;
  _queue: TransitionInstruction[] = [];
  _sbEnabled: boolean;
  _sbTrns: Transition;
  _trnsId: number = null;
  _trnsTm = false;
  _views: ViewController[] = [];
  _zIndexOffset = 0;
  _destroyed: boolean;
  _errHandler: any = null;

  @Event() viewDidLoad: EventEmitter;
  @Event() viewWillEnter: EventEmitter;
  @Event() viewDidEnter: EventEmitter;
  @Event() viewWillLeave: EventEmitter;
  @Event() viewDidLeave: EventEmitter;
  @Event() viewWillUnload: EventEmitter;

  id: string;
  name: string;
  mode: string;

  parent: any;

  @Prop({context: 'dom'}) dom: DomController;
  @Prop({context: 'config'}) config: Config;

  app: HTMLIonAppElement;
  @Prop() root: any;
  @Prop() delegate: FrameworkDelegate;
  @Prop() routerDelegate: RouterDelegate;
  @Prop() useUrls = false;
  @Prop({ connect: 'ion-animation-controller' }) animationCtrl: HTMLIonAnimationControllerElement;
  @Prop() lazy = false;
  @Prop() swipeBackEnabled = true;

  @Element() el: HTMLElement;

  componentDidLoad() {
    this._sbEnabled = this.config.getBoolean('swipeBackEnabled');
    this._children = [];
    this.id = 'n' + (++ctrlIds);
    this._destroyed = false;

    // TODO, not here
    if (this.root) {
      this.setRoot(this.root);
    }
  }

  @Method()
  push(page: any, params?: any, opts?: NavOptions, done?: TransitionDoneFn): Promise<any> {
    return this._queueTrns({
      insertStart: -1,
      insertViews: [{ page: page, params: params }],
      opts: opts,
    }, done);
  }

  @Method()
  insert(insertIndex: number, page: any, params?: any, opts?: NavOptions, done?: TransitionDoneFn): Promise<any> {
    return this._queueTrns({
      insertStart: insertIndex,
      insertViews: [{ page: page, params: params }],
      opts: opts,
    }, done);
  }

  @Method()
  insertPages(insertIndex: number, insertPages: any[], opts?: NavOptions, done?: TransitionDoneFn): Promise<any> {
    return this._queueTrns({
      insertStart: insertIndex,
      insertViews: insertPages,
      opts: opts,
    }, done);
  }

  @Method()
  pop(opts?: NavOptions, done?: TransitionDoneFn): Promise<any> {
    return this._queueTrns({
      removeStart: -1,
      removeCount: 1,
      opts: opts,
    }, done);
  }

  @Method()
  popTo(indexOrViewCtrl: any, opts?: NavOptions, done?: TransitionDoneFn): Promise<any> {
    const config: TransitionInstruction = {
      removeStart: -1,
      removeCount: -1,
      opts: opts
    };
    if (isViewController(indexOrViewCtrl)) {
      config.removeView = indexOrViewCtrl;
      config.removeStart = 1;
    } else if (isNumber(indexOrViewCtrl)) {
      config.removeStart = indexOrViewCtrl + 1;
    }
    return this._queueTrns(config, done);
  }

  @Method()
  popToRoot(opts?: NavOptions, done?: TransitionDoneFn): Promise<any> {
    return this._queueTrns({
      removeStart: 1,
      removeCount: -1,
      opts: opts,
    }, done);
  }

  @Method()
  popAll(): Promise<any[]> {
    const promises: any[] = [];
    for (let i = this._views.length - 1; i >= 0; i--) {
      promises.push(this.pop(null));
    }
    return Promise.all(promises);
  }

  @Method()
  removeIndex(startIndex: number, removeCount = 1, opts?: NavOptions, done?: TransitionDoneFn): Promise<any> {
    return this._queueTrns({
      removeStart: startIndex,
      removeCount: removeCount,
      opts: opts,
    }, done);
  }

  @Method()
  removeView(viewController: ViewController, opts?: NavOptions, done?: TransitionDoneFn): Promise<any> {
    return this._queueTrns({
      removeView: viewController,
      removeStart: 0,
      removeCount: 1,
      opts: opts,
    }, done);
  }

  @Method()
  setRoot(pageOrViewCtrl: any, params?: any, opts?: NavOptions, done?: TransitionDoneFn): Promise<any> {
    return this.setPages([{ page: pageOrViewCtrl, params: params }], opts, done);
  }

  @Method()
  setPages(viewControllers: any[], opts?: NavOptions, done?: TransitionDoneFn): Promise<any> {
    if (isBlank(opts)) {
      opts = {};
    }
    // if animation wasn't set to true then default it to NOT animate
    if (opts.animate !== true) {
      opts.animate = false;
    }
    return this._queueTrns({
      insertStart: 0,
      insertViews: viewControllers,
      removeStart: 0,
      removeCount: -1,
      opts: opts
    }, done);
  }

  // _queueTrns() adds a navigation stack change to the queue and schedules it to run:
  // 1. _nextTrns(): consumes the next transition in the queue
  // 2. _viewInit(): initializes enteringView if required
  // 3. _viewTest(): ensures canLeave/canEnter returns true, so the operation can continue
  // 4. _postViewInit(): add/remove the views from the navigation stack
  // 5. _transitionInit(): initializes the visual transition if required and schedules it to run
  // 6. _viewAttachToDOM(): attaches the enteringView to the DOM
  // 7. _transitionStart(): called once the transition actually starts, it initializes the Animation underneath.
  // 8. _transitionFinish(): called once the transition finishes
  // 9. _cleanup(): syncs the navigation internal state with the DOM. For example it removes the pages from the DOM or hides/show them.
  _queueTrns(ti: TransitionInstruction, done: TransitionDoneFn): Promise<boolean> {
    const promise = new Promise<boolean>((resolve, reject) => {
      ti.resolve = resolve;
      ti.reject = reject;
    });
    ti.done = done;

    // Normalize empty
    if (ti.insertViews && ti.insertViews.length === 0) {
      ti.insertViews = undefined;
    }

    // Enqueue transition instruction
    this._queue.push(ti);

    // if there isn't a transition already happening
    // then this will kick off this transition
    this._nextTrns();

    return promise;
  }

  _success(result: NavResult, ti: TransitionInstruction) {
    if (this._queue === null) {
      this._fireError('nav controller was destroyed', ti);
      return;
    }
    this._init = true;
    this._trnsId = null;

    // ensure we're not transitioning here
    this.setTransitioning(false);
    // let's see if there's another to kick off
    this._nextTrns();

    if (ti.done) {
      ti.done(
        result.hasCompleted,
        result.requiresTransition,
        result.enteringName,
        result.leavingName,
        result.direction
      );
    }
    ti.resolve(result.hasCompleted);
  }

  _failed(rejectReason: any, ti: TransitionInstruction) {
    if (this._queue === null) {
      this._fireError('nav controller was destroyed', ti);
      return;
    }
    this._trnsId = null;
    this._queue.length = 0;

    // let's see if there's another to kick off
    this.setTransitioning(false);
    this._nextTrns();

    this._fireError(rejectReason, ti);
  }

  _fireError(rejectReason: any, ti: TransitionInstruction) {
    if (ti.done) {
      ti.done(false, false, rejectReason);
    }
    if (ti.reject && !this._destroyed) {
      ti.reject(rejectReason);
    } else {
      ti.resolve(false);
    }
  }

  _nextTrns(): boolean {
    // this is the framework's bread 'n butta function
    // only one transition is allowed at any given time
    if (this.isTransitioning()) {
      return false;
    }

    // there is no transition happening right now
    // get the next instruction
    const ti = this._queue.shift();
    if (!ti) {
      return false;
    }

    // set that this nav is actively transitioning
    let enteringView: ViewController;
    let leavingView: ViewController;

    this._startTI(ti)
      .then(() => this._loadLazyLoading(ti))
      .then(() => {
        leavingView = this.getActive();
        enteringView = this._getEnteringView(ti, leavingView);

        if (!leavingView && !enteringView) {
          throw new Error('no views in the stack to be removed');
        }

        // Needs transition?
        ti.requiresTransition = (ti.enteringRequiresTransition || ti.leavingRequiresTransition) && enteringView !== leavingView;

        if (enteringView && enteringView._state === STATE_NEW) {
          this._viewInit(enteringView);
        }
      })
      .then(() => this._postViewInit(enteringView, leavingView, ti))
      .then(() => this._transition(enteringView, leavingView, ti))
      .then((result) => this._success(result, ti))
      .catch((rejectReason) => this._failed(rejectReason, ti));

    return true;
  }

  _waitUntilReady(enteringView: ViewController, leavingView: ViewController) {
    const promises = [];
    if (enteringView && (enteringView.element as any).componentOnReady) {
      promises.push((enteringView.element as any).componentOnReady());
    }
    if (leavingView && (leavingView.element as any).componentOnReady) {
      promises.push((leavingView.element as any).componentOnReady());
    }
    return Promise.all(promises);
  }

  _startTI(ti: TransitionInstruction): Promise<void> {
    const viewsLength = this._views.length;

    if (isPresent(ti.removeView)) {
      assert(isPresent(ti.removeStart), 'removeView needs removeStart');
      assert(isPresent(ti.removeCount), 'removeView needs removeCount');

      const index = this.indexOf(ti.removeView);
      if (index < 0) {
        return Promise.reject('removeView was not found');
      }
      ti.removeStart += index;
    }
    if (isPresent(ti.removeStart)) {
      if (ti.removeStart < 0) {
        ti.removeStart = (viewsLength - 1);
      }
      if (ti.removeCount < 0) {
        ti.removeCount = (viewsLength - ti.removeStart);
      }
      ti.leavingRequiresTransition = (ti.removeCount > 0) && ((ti.removeStart + ti.removeCount) === viewsLength);
    }

    if (ti.insertViews) {
      // allow -1 to be passed in to auto push it on the end
      // and clean up the index if it's larger then the size of the stack
      if (ti.insertStart < 0 || ti.insertStart > viewsLength) {
        ti.insertStart = viewsLength;
      }
      ti.enteringRequiresTransition = (ti.insertStart === viewsLength);
    }
    this.setTransitioning(true);
    return Promise.resolve();
  }

  _loadLazyLoading(ti: TransitionInstruction): Promise<void> {
    const insertViews = ti.insertViews;
    if (insertViews) {
      assert(insertViews.length > 0, 'length can not be zero');
      return convertToViews(insertViews).then((viewControllers) => {
        assert(insertViews.length === viewControllers.length, 'lengths does not match');

        viewControllers = viewControllers.filter(v => v !== null);
        if (viewControllers.length === 0) {
          throw new Error('invalid views to insert');
        }
        // Check all the inserted view are correct
        for (let i = 0; i < viewControllers.length; i++) {
          const view = viewControllers[i];
          const nav = view._nav;
          if (nav && nav !== this) {
            throw new Error('inserted view was already inserted');
          }
          if (view._state === STATE_DESTROYED) {
            throw new Error('inserted view was already destroyed');
          }
        }
        ti.insertViews = viewControllers;
      });
    }
    return Promise.resolve();
  }

  _getEnteringView(ti: TransitionInstruction, leavingView: ViewController): ViewController {
    const insertViews = ti.insertViews;
    if (insertViews) {
      // grab the very last view of the views to be inserted
      // and initialize it as the new entering view
      return insertViews[insertViews.length - 1];
    }

    const removeStart = ti.removeStart;
    if (isPresent(removeStart)) {
      const views = this._views;
      const removeEnd = removeStart + ti.removeCount;
      let i: number;
      let view: ViewController;
      for (i = views.length - 1; i >= 0; i--) {
        view = views[i];
        if ((i < removeStart || i >= removeEnd) && view !== leavingView) {
          return view;
        }
      }
    }
    return null;
  }

  _postViewInit(enteringView: ViewController, leavingView: ViewController, ti: TransitionInstruction) {
    assert(leavingView || enteringView, 'Both leavingView and enteringView are null');
    assert(ti.resolve, 'resolve must be valid');
    assert(ti.reject, 'reject must be valid');

    const opts = ti.opts || {};
    const insertViews = ti.insertViews;
    const removeStart = ti.removeStart;
    const removeCount = ti.removeCount;
    let view: ViewController;
    let i: number;
    let destroyQueue: ViewController[];

    // there are views to remove
    if (isPresent(removeStart)) {
      assert(removeStart >= 0, 'removeStart can not be negative');
      assert(removeCount >= 0, 'removeCount can not be negative');

      destroyQueue = [];
      for (i = 0; i < removeCount; i++) {
        view = this._views[i + removeStart];
        if (view && view !== enteringView && view !== leavingView) {
          destroyQueue.push(view);
        }
      }
      // default the direction to "back"
      opts.direction = opts.direction || DIRECTION_BACK;
    }

    const finalBalance = this._views.length + (insertViews ? insertViews.length : 0) - (removeCount ? removeCount : 0);
    assert(finalBalance >= 0, 'final balance can not be negative');
    if (finalBalance === 0 && !this._isPortal) {
      console.warn(`You can't remove all the pages in the navigation stack. nav.pop() is probably called too many times.`,
        this, this.getNativeElement());

      throw new Error('navigation stack needs at least one root page');
    }

    // At this point the transition can not be rejected, any throw should be an error
    // there are views to insert
    if (insertViews) {
      // manually set the new view's id if an id was passed in the options
      if (isPresent(opts.id)) {
        enteringView.id = opts.id;
      }

      // add the views to the
      for (i = 0; i < insertViews.length; i++) {
        view = insertViews[i];
        this._insertViewAt(view, ti.insertStart + i);
      }

      if (ti.enteringRequiresTransition) {
        // default to forward if not already set
        opts.direction = opts.direction || DIRECTION_FORWARD;
      }
    }

    // if the views to be removed are in the beginning or middle
    // and there is not a view that needs to visually transition out
    // then just destroy them and don't transition anything
    // batch all of lifecycles together
    // let's make sure, callbacks are zoned
    if (destroyQueue && destroyQueue.length > 0) {
      for (i = 0; i < destroyQueue.length; i++) {
        view = destroyQueue[i];
        this._willLeave(view, true);
        this._didLeave(view);
        this._willUnload(view);
      }

      // once all lifecycle events has been delivered, we can safely detroy the views
      for (i = 0; i < destroyQueue.length; i++) {
        this._destroyView(destroyQueue[i]);
      }
    }

    // set which animation it should use if it wasn't set yet
    if (ti.requiresTransition && !opts.animation) {
      opts.animation = isPresent(ti.removeStart)
        ? (leavingView || enteringView).getTransitionName(opts.direction)
        : (enteringView || leavingView).getTransitionName(opts.direction);
    }
    ti.opts = opts;
  }

  /**
   * DOM WRITE
   */
  _viewInit(enteringView: ViewController) {
    assert(enteringView, 'enteringView must be non null');

    // TODO

    // assert(enteringView._state === STATE_NEW, 'enteringView state must be NEW');

    //  // render the entering view, and all child navs and views
    // // entering view has not been initialized yet
    // const componentProviders = ReflectiveInjector.resolve([
    //   { provide: NavController, useValue: this },
    //   { provide: ViewController, useValue: enteringView },
    //   { provide: NavParams, useValue: enteringView.getNavParams() }
    // ]);
    // const componentFactory = this._linker.resolveComponent(enteringView.component);
    // const childInjector = ReflectiveInjector.fromResolvedProviders(componentProviders, this._viewport.parentInjector);

    // // create ComponentRef and set it to the entering view
    // enteringView.init(componentFactory.create(childInjector, []));
    // enteringView.init()
    enteringView.element = document.createElement(enteringView.component);
    enteringView._state = STATE_INITIALIZED;
    this._preLoad(enteringView);
  }

  _viewAttachToDOM(view: ViewController, pageElement: HTMLElement) {
    assert(view._state === STATE_INITIALIZED, 'view state must be INITIALIZED');
    assert(pageElement, 'componentRef can not be null');

    // fire willLoad before change detection runs
    this._willLoad(view);

    // render the component ref instance to the DOM
    // ******** DOM WRITE ****************
    this.el.appendChild(pageElement);
    view._state = STATE_ATTACHED;

    if (view._cssClass) {
      // the ElementRef of the actual ion-page created
      // ******** DOM WRITE ****************+
      pageElement.classList.add(view._cssClass);
    }

    // componentRef.changeDetectorRef.detectChanges();

    // successfully finished loading the entering view
    // fire off the "didLoad" lifecycle events
    this._didLoad(view);
  }

  _transition(enteringView: ViewController, leavingView: ViewController, ti: TransitionInstruction): Promise<NavResult> {
    if (!ti.requiresTransition) {
      // transition is not required, so we are already done!
      // they're inserting/removing the views somewhere in the middle or
      // beginning, so visually nothing needs to animate/transition
      // resolve immediately because there's no animation that's happening
      return Promise.resolve({
        hasCompleted: true,
        requiresTransition: false
      });
    }

    const opts = ti.opts;

    // figure out if this transition is the root one or a
    // child of a parent nav that has the root transition
    this._trnsId = TrnsCtrl.getRootTrnsId(this);
    if (this._trnsId === null) {
      // this is the root transition, meaning all child navs and their views
      // should be added as a child transition to this one
      this._trnsId = TrnsCtrl.nextId();
    }

    // create the transition options
    const animationOpts: AnimationOptions = {
      animation: opts.animation,
      direction: opts.direction,
      duration: (opts.animate === false ? 0 : opts.duration),
      easing: opts.easing,
      isRTL: false,
      // isRTL: this.config.plt.isRTL,
      ev: opts.ev,
      enteringEl: enteringView ? enteringView.element : undefined,
      leavingEl: leavingView ? leavingView.element : undefined,
      nav: this,
    };

    const transition = new Transition(
      this.animationCtrl,
      iosTransitionAnimation,
      enteringView,
      leavingView,
      animationOpts
    );
    TrnsCtrl.register(this._trnsId, transition);

    // ensure any swipeback transitions are cleared out
    this._sbTrns && this._sbTrns.destroy();
    this._sbTrns = null;

    // swipe to go back root transition
    if (!transition.parent && opts.progressAnimation) {
      this._sbTrns = transition;
    }

    // transition start has to be registered before attaching the view to the DOM!
    const promise = new Promise<void>(resolve => transition.registerStart(resolve))
      .then(() => this._transitionInit(transition, enteringView, leavingView, opts))
      .then(() => this._transitionStart(transition, enteringView, leavingView, opts));

    if (enteringView && (enteringView._state === STATE_INITIALIZED)) {
      // render the entering component in the DOM
      // this would also render new child navs/views
      // which may have their very own async canEnter/Leave tests
      // ******** DOM WRITE ****************
      this._viewAttachToDOM(enteringView, enteringView.element);
    }


    // if (!transition.hasChildren) {
      // lowest level transition, so kick it off and let it bubble up to start all of them
      transition.start();
    // }
    return promise;
  }


  _transitionInit(transition: Transition, enteringView: ViewController, leavingView: ViewController, opts: NavOptions): Promise<void> {
    assert(this.isTransitioning(), 'isTransitioning() has to be true');

    this._trnsId = null;

    // set the correct zIndex for the entering and leaving views
    // ******** DOM WRITE ****************
    setZIndex(this, enteringView, leavingView, opts.direction);

    // always ensure the entering view is viewable
    // ******** DOM WRITE ****************
    enteringView && enteringView._domShow(true);

    // always ensure the leaving view is viewable
    // ******** DOM WRITE ****************
    leavingView && leavingView._domShow(true);

    // initialize the transition
    return transition.init();
  }

  _transitionStart(transition: Transition, enteringView: ViewController, leavingView: ViewController, opts: NavOptions): Promise<NavResult> {
    assert(this.isTransitioning(), 'isTransitioning() has to be true');

    // we should animate (duration > 0) if the pushed page is not the first one (startup)
    // or if it is a portal (modal, actionsheet, etc.)
    const isFirstPage = !this._init && this._views.length === 1;
    const shouldNotAnimate = isFirstPage && !this._isPortal;
    const canNotAnimate = this.config.get('animate') === false;
    if (shouldNotAnimate || canNotAnimate) {
      opts.animate = false;
    }

    if (opts.animate === false) {
      // if it was somehow set to not animation, then make the duration zero
      transition.ani.duration(0);
    }

    // create a callback that needs to run within zone
    // that will fire off the willEnter/Leave lifecycle events at the right time
    transition.ani.beforeAddRead(this._viewsWillLifecycles.bind(this, enteringView, leavingView));

    // get the set duration of this transition
    const duration = transition.ani.getDuration();

    // create a callback for when the animation is done
    const promise = new Promise(resolve => {
      transition.ani.onFinish(resolve);
    });

    if (transition.ani.isRoot()) {
      // this is the top most, or only active transition, so disable the app
      // add XXms to the duration the app is disabled when the keyboard is open
      if (duration > DISABLE_APP_MINIMUM_DURATION && opts.disableApp !== false) {
        // if this transition has a duration and this is the root transition
        // then set that the app is actively disabled
        // TODO
        // this.app.setEnabled(false, duration + ACTIVE_TRANSITION_OFFSET, opts.minClickBlockDuration);
      } else {
        console.debug('transition is running but app has not been disabled');
      }

      // cool, let's do this, start the transition
      if (opts.progressAnimation) {
        // this is a swipe to go back, just get the transition progress ready
        // kick off the swipe animation start
        transition.ani.progressStart();

      } else {
        // only the top level transition should actually start "play"
        // kick it off and let it play through
        // ******** DOM WRITE ****************
        transition.ani.play();
      }
    }

    return promise.then(() => {
      return this._transitionFinish(transition, opts);
    });
  }

  _transitionFinish(transition: Transition, opts: NavOptions): NavResult {

    const hasCompleted = transition.ani.hasCompleted;
    const enteringView = transition.enteringView;
    const leavingView = transition.leavingView;

    // mainly for testing
    let enteringName: string;
    let leavingName: string;

    if (hasCompleted) {
      // transition has completed (went from 0 to 1)
      if (enteringView) {
        enteringName = enteringView.name;
        this._didEnter(enteringView);
      }

      if (leavingView) {
        leavingName = leavingView.name;
        this._didLeave(leavingView);
      }

      this._cleanup(enteringView);
    } else {
      // If transition does not complete, we have to cleanup anyway, because
      // previous pages in the stack are not hidden probably.
      this._cleanup(leavingView);
    }

    if (transition.ani.isRoot()) {
      // this is the root transition
      // it's safe to destroy this transition
      TrnsCtrl.destroy(transition.trnsId);

      // it's safe to enable the app again
      // TODO: app enabled
      // this.app.setEnabled(true);
      // mark ourselves as not transitioning - `deepLinker navchange` requires this
      // TODO - probably could be resolved in a better way
      this.setTransitioning(false);

      if (!this.hasChildren() && opts.updateUrl !== false) {
        // notify deep linker of the nav change
        // if a direction was provided and should update url
        // this._linker.navChange(opts.direction);
      }

      if (opts.keyboardClose !== false) {
        // the keyboard is still open!
        // no problem, let's just close for them
        // TODO
        // this.plt.focusOutActiveElement();
      }
    }

    return {
      hasCompleted: hasCompleted,
      requiresTransition: true,
      enteringName: enteringName,
      leavingName: leavingName,
      direction: opts.direction
    };
  }

  _viewsWillLifecycles(enteringView: ViewController, leavingView: ViewController) {
    if (enteringView || leavingView) {
      // Here, the order is important. WillLeave must be called before WillEnter.
      if (leavingView) {
        const willUnload = enteringView ? leavingView.index > enteringView.index : true;
        this._willLeave(leavingView, willUnload);
      }
      enteringView && this._willEnter(enteringView);
    }
  }

  _insertViewAt(view: ViewController, index: number) {
    const existingIndex = this._views.indexOf(view);
    if (existingIndex > -1) {
      // this view is already in the stack!!
      // move it to its new location
      assert(view._nav === this, 'view is not part of the nav');
      this._views.splice(index, 0, this._views.splice(existingIndex, 1)[0]);
    } else {
      assert(!view._nav || (this._isPortal && view._nav === this), 'nav is used');
      // this is a new view to add to the stack
      // create the new entering view
      view._setNav(this);

      // give this inserted view an ID
      this._ids++;
      if (!view.id) {
        view.id = `${this.id}-${this._ids}`;
      }

      // insert the entering view into the correct index in the stack
      this._views.splice(index, 0, view);
    }
  }

  _removeView(view: ViewController) {
    assert(view._state === STATE_ATTACHED || view._state === STATE_DESTROYED, 'view state should be loaded or destroyed');

    const views = this._views;
    const index = views.indexOf(view);
    assert(index > -1, 'view must be part of the stack');
    if (index >= 0) {
      views.splice(index, 1);
    }
  }

  _destroyView(view: ViewController) {
    view._destroy();
    this._removeView(view);
  }

  /**
   * DOM WRITE
   */
  _cleanup(activeView: ViewController) {
    // ok, cleanup time!! Destroy all of the views that are
    // INACTIVE and come after the active view
    // only do this if the views exist, though
    if (!this._destroyed) {
      const activeViewIndex = this._views.indexOf(activeView);
      const views = this._views;
      let reorderZIndexes = false;
      let view: ViewController;
      let i: number;

      for (i = views.length - 1; i >= 0; i--) {
        view = views[i];
        if (i > activeViewIndex) {
          // this view comes after the active view
          // let's unload it
          this._willUnload(view);
          this._destroyView(view);

        } else if (i < activeViewIndex && !this._isPortal) {
          // this view comes before the active view
          // and it is not a portal then ensure it is hidden
          view._domShow(false);
        }
        if (view._zIndex <= 0) {
          reorderZIndexes = true;
        }
      }

      if (!this._isPortal && reorderZIndexes) {
        for (i = 0; i < views.length; i++) {
          view = views[i];
          // ******** DOM WRITE ****************
          view._setZIndex(view._zIndex + INIT_ZINDEX + 1);
        }
      }
    }
  }

  _preLoad(view: ViewController) {
    assert(this.isTransitioning(), 'nav controller should be transitioning');

    view._preLoad();
  }

  _willLoad(view: ViewController) {
    assert(this.isTransitioning(), 'nav controller should be transitioning');

    try {
      view._willLoad();
    } catch (e) {
      this._errHandler && this._errHandler.handleError(e);
    }
  }

  _didLoad(view: ViewController) {
    assert(this.isTransitioning(), 'nav controller should be transitioning');

    try {
      view._didLoad();
      this.viewDidLoad.emit(view);
    } catch (e) {
      this._errHandler && this._errHandler.handleError(e);
    }
  }

  _willEnter(view: ViewController) {
    assert(this.isTransitioning(), 'nav controller should be transitioning');

    try {
      view._willEnter();
      this.viewWillEnter.emit(view);
    } catch (e) {
      this._errHandler && this._errHandler.handleError(e);
    }
  }

  _didEnter(view: ViewController) {
    assert(this.isTransitioning(), 'nav controller should be transitioning');

    try {
      view._didEnter();
      this.viewDidEnter.emit(view);
    } catch (e) {
      this._errHandler && this._errHandler.handleError(e);
    }
  }

  _willLeave(view: ViewController, willUnload: boolean) {
    assert(this.isTransitioning(), 'nav controller should be transitioning');

    try {
      view._willLeave(willUnload);
      this.viewWillLeave.emit(view);
    } catch (e) {
      this._errHandler && this._errHandler.handleError(e);
    }
  }

  _didLeave(view: ViewController) {
    assert(this.isTransitioning(), 'nav controller should be transitioning');

    try {
      view._didLeave();
      this.viewDidLeave.emit(view);
    } catch (e) {
      this._errHandler && this._errHandler.handleError(e);
    }
  }

  _willUnload(view: ViewController) {
    assert(this.isTransitioning(), 'nav controller should be transitioning');

    try {
      view._willUnload();
      this.viewWillUnload.emit(view);
    } catch (e) {
      this._errHandler && this._errHandler.handleError(e);
    }
  }

  hasChildren(): boolean {
    return this._children && this._children.length > 0;
  }

  getActiveChildNavs(): any[] {
    return this._children;
  }

  getAllChildNavs(): any[] {
    return this._children;
  }

  // registerChildNav(container: NavigationContainer) {
  //   this._children.push(container);
  // }

  // unregisterChildNav(nav: any) {
  //   this._children = this._children.filter(child => child !== nav);
  // }

  destroy() {
    const views = this._views;
    let view: ViewController;
    for (let i = 0; i < views.length; i++) {
      view = views[i];
      view._willUnload();
      view._destroy();
    }

    // release swipe back gesture and transition
    this._sbTrns && this._sbTrns.destroy();
    this._queue = this._views = this._sbTrns = null;

    // Unregister navcontroller
    if (this.parent && this.parent.unregisterChildNav) {
      // TODO: event
      this.parent.unregisterChildNav(this);
    } else if (this.app) {
      // TODO: event
      this.app.unregisterRootNav(this);
    }

    this._destroyed = true;
  }

  swipeBackStart() {
    if (this.isTransitioning() || this._queue.length > 0) {
      return;
    }

    // default the direction to "back";
    const opts: NavOptions = {
      direction: DIRECTION_BACK,
      progressAnimation: true
    };

    this._queueTrns({
      removeStart: -1,
      removeCount: 1,
      opts: opts,
    }, null);
  }

  swipeBackProgress(detail: GestureDetail) {
    if (this._sbTrns) {
      // continue to disable the app while actively dragging
      // TODO
      // this.app.setEnabled(false, ACTIVE_TRANSITION_DEFAULT);
      this.setTransitioning(true);

      // set the transition animation's progress
      const delta = detail.deltaX;
      const stepValue = delta / window.innerWidth;
      // set the transition animation's progress
      this._sbTrns.ani.progressStep(stepValue);
    }
  }

  swipeBackEnd(detail: GestureDetail) {
    if (this._sbTrns) {
      // the swipe back gesture has ended
      const delta = detail.deltaX;
      const width = window.innerWidth;
      const stepValue = delta / width;
      const velocity = detail.velocityX;
      const z = width / 2.0;
      const shouldComplete = (velocity >= 0)
        && (velocity > 0.2 || detail.deltaX > z);

      const missing = shouldComplete ? 1 - stepValue : stepValue;
      const missingDistance = missing * width;
      let realDur = 0;
      if (missingDistance > 5) {
        const dur = missingDistance / Math.abs(velocity);
        realDur = Math.min(dur, 300);
      }

      this._sbTrns.ani.progressEnd(shouldComplete, stepValue, realDur);
    }
  }

  canSwipeBack(): boolean {
    return (this._sbEnabled &&
            !this._isPortal &&
            !this._children.length &&
            !this.isTransitioning() &&
            this.app.isEnabled() &&
            this.canGoBack());
  }

  canGoBack(): boolean {
    const activeView = this.getActive();
    return !!(activeView && activeView.enableBack());
  }

  isTransitioning(): boolean {
    return this._trnsTm;
  }

  setTransitioning(isTransitioning: boolean) {
    this._trnsTm = isTransitioning;
  }

  getActive(): ViewController {
    return this._views[this._views.length - 1];
  }

  isActive(view: ViewController): boolean {
    return (view === this.getActive());
  }

  getByIndex(index: number): ViewController {
    return this._views[index];
  }

  getPrevious(view?: ViewController): ViewController {
    // returns the view controller which is before the given view controller.
    if (!view) {
      view = this.getActive();
    }
    const views = this._views;
    const index = views.indexOf(view);
    return (index > 0) ? views[index - 1] : null;
  }

  first(): ViewController {
    // returns the first view controller in this nav controller's stack.
    return this._views[0];
  }

  last(): ViewController {
    // returns the last page in this nav controller's stack.
    const views = this._views;
    return views[views.length - 1];
  }

  indexOf(view: ViewController): number {
    // returns the index number of the given view controller.
    return this._views.indexOf(view);
  }

  length(): number {
    return this._views.length;
  }

  getViews(): Array<ViewController> {
    return this._views;
  }

  /**
   * Return a view controller
   */
  getViewById(id: string): ViewController {
    for (const vc of this._views) {
      if (vc && vc.id === id) {
        return vc;
      }
    }
    return null;
  }

  isSwipeBackEnabled(): boolean {
    return this._sbEnabled;
  }

  dismissPageChangeViews() {
    for (const view of this._views) {
      if (view.data && view.data.dismissOnPageChange) {
        view.dismiss().catch();
      }
    }
  }

  goToRoot(_opts: NavOptions): Promise<any> {
    return Promise.reject(new Error('goToRoot needs to be implemented by child class'));
  }

  /*
   * @private
   */
  getType() {
    return 'nav';
  }

  /*
   * @private
   */
  getSecondaryIdentifier(): string {
    return null;
  }

  /**
   * Returns the active child navigation.
   */
  getActiveChildNav(): any {
    console.warn('(getActiveChildNav) is deprecated and will be removed in the next major release. Use getActiveChildNavs instead.');
    return this._children[this._children.length - 1];
  }

  getNativeElement(): HTMLElement {
    return this.el;
  }

  render() {
    const dom = [];
    if (this.swipeBackEnabled) {
      dom.push(<ion-gesture
        canStart={this.canSwipeBack.bind(this)}
        onStart={this.swipeBackStart.bind(this)}
        onMove={this.swipeBackProgress.bind(this)}
        onEnd={this.swipeBackEnd.bind(this)}
        gestureName='goback-swipe'
        gesturePriority={10}
        type='pan'
        direction='x'
        threshold={10}
        attachTo='body'/>);
    }
    if (this.mode === 'ios') {
      dom.push(<div class='nav-decor'/>);
    }
    dom.push(<slot></slot>);
    return dom;
  }
}

let ctrlIds = -1;

const DISABLE_APP_MINIMUM_DURATION = 64;
// const ACTIVE_TRANSITION_DEFAULT = 5000;
// const ACTIVE_TRANSITION_OFFSET = 2000;
