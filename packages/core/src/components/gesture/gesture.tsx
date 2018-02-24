import { Component, EventListenerEnable, Listen, Prop, Watch, Method } from '@stencil/core';
import { now, updateDetail } from '../../utils/helpers';
import { DomController, BlockerDelegate, GestureDelegate } from '../../index';
import { PanRecognizer } from './recognizers';

@Component({
  tag: 'ion-gesture'
})
export class Gesture {

  private detail: GestureDetail = {};
  private positions: number[] = [];
  private gesture: GestureDelegate;
  private lastTouch = 0;
  private pan: PanRecognizer;
  private hasCapturedPan = false;
  private hasStartedPan = false;
  private hasFiredStart = true;
  private isMoveQueued = false;
  private blocker: BlockerDelegate;

  @Prop({ connect: 'ion-gesture-controller' }) gestureCtrl: HTMLIonGestureControllerElement;
  @Prop({ context: 'dom' }) dom: DomController;
  @Prop({ context: 'enableListener' }) enableListener: EventListenerEnable;

  @Prop() disabled = false;
  @Prop() attachTo = 'child';
  @Prop() disableScroll = false;
  @Prop() direction = 'x';
  @Prop() gestureName = '';
  @Prop() gesturePriority = 0;
  @Prop() passive = true;
  @Prop() maxAngle = 40;
  @Prop() threshold = 10;

  @Prop() canStart: GestureCallback;
  @Prop() onWillStart: (detail: GestureDetail) => Promise<void>;
  @Prop() onStart: GestureCallback;
  @Prop() onMove: GestureCallback;
  @Prop() onEnd: GestureCallback;
  @Prop() notCaptured: GestureCallback;

  @Watch('disabled')
  protected disabledChanged() {
    const disabled = this.disabled;
    this.enableListener(this, 'touchstart', !disabled, this.attachTo, this.passive);
    this.enableListener(this, 'mousedown', !disabled, this.attachTo, this.passive);
    if (disabled) {
      this.stop();
    }
  }

  componentWillLoad() {
    return this.gestureCtrl.create({
      name: this.gestureName,
      priority: this.gesturePriority,
      disableScroll: this.disableScroll
    }).then((gesture) => this.gesture = gesture);
  }

  componentDidLoad() {
    this.pan = new PanRecognizer(this.direction, this.threshold, this.maxAngle);
    this.disabledChanged();
  }

  componentDidUnload() {
    if (this.blocker) {
      this.blocker.destroy();
      this.blocker = null;
    }
    this.gesture && this.gesture.destroy();
    this.gesture = this.detail = this.attachTo = this.detail.event = null;
  }

  @Method()
  stop() {
    this.reset();
    this.enable(false);
  }

  // DOWN *************************

  @Listen('touchstart', { passive: true, enabled: false })
  onTouchStart(ev: TouchEvent) {
    this.lastTouch = now(ev);

    if (this.pointerDown(ev, this.lastTouch)) {
      this.enableMouse(false);
      this.enableTouch(true);
    } else {
      this.abortGesture();
    }
  }

  @Listen('mousedown', { passive: true, enabled: false })
  onMouseDown(ev: MouseEvent) {
    const timeStamp = now(ev);

    if (this.lastTouch + MOUSE_WAIT < timeStamp) {
      if (this.pointerDown(ev, timeStamp)) {
        this.enableMouse(true);
        this.enableTouch(false);
      } else {
        this.abortGesture();
      }
    }
  }

  private pointerDown(ev: UIEvent, timeStamp: number): boolean {
    if (!this.gesture || this.hasStartedPan || !this.hasFiredStart) {
      return false;
    }
    const positions = this.positions;
    const detail = this.detail;

    updateDetail(ev, detail);
    detail.startX = detail.currentX;
    detail.startY = detail.currentY;
    detail.startTimeStamp = detail.timeStamp = timeStamp;
    detail.velocityX = detail.velocityY = detail.deltaX = detail.deltaY = 0;
    detail.event = ev;
    positions.length = 0;

    // Check if gesture can start
    if (this.canStart && this.canStart(detail) === false) {
      return false;
    }
    // Release fallback
    this.gesture.release();

    // Start gesture
    if (!this.gesture.start()) {
      return false;
    }

    positions.push(detail.currentX, detail.currentY, timeStamp);
    this.hasStartedPan = true;
    if (this.threshold === 0) {
      return this.tryToCapturePan();
    }
    this.pan.start(detail.startX, detail.startY);
    return true;
  }

  // MOVE *************************

  @Listen('touchmove', { passive: true, enabled: false })
  onTouchMove(ev: TouchEvent) {
    this.lastTouch = this.detail.timeStamp = now(ev);
    this.pointerMove(ev);
  }


  @Listen('document:mousemove', { passive: true, enabled: false })
  onMoveMove(ev: TouchEvent) {
    const timeStamp = now(ev);
    if (this.lastTouch + MOUSE_WAIT < timeStamp) {
      this.detail.timeStamp = timeStamp;
      this.pointerMove(ev);
    }
  }

  private pointerMove(ev: UIEvent) {
    // fast path, if gesture is currently captured
    // do minimun job to get user-land even dispatched
    if (this.hasCapturedPan) {
      if (!this.isMoveQueued && this.hasFiredStart) {
        this.isMoveQueued = true;
        this.calcGestureData(ev);
        this.dom.write(this.fireOnMove.bind(this));
      }
      return;
    }

    // gesture is currently being detected
    const detail = this.detail;
    this.calcGestureData(ev);
    if (
      this.pan.detect(detail.currentX, detail.currentY) &&
      this.pan.isGesture() &&
      !this.tryToCapturePan()
    ) {
      this.abortGesture();
    }
  }

  private fireOnMove() {
    // Since fireOnMove is called inside a RAF, onEnd() might be called,
    // we must double check hasCapturedPan
    if (!this.hasCapturedPan) {
      return;
    }
    const detail = this.detail;
    this.isMoveQueued = false;
    if (this.onMove) {
      const result = this.onMove(detail);
      if (result === false) {
        this.stop();
      }
    }
  }

  private calcGestureData(ev: UIEvent) {
    const detail = this.detail;
    updateDetail(ev, detail);

    const currentX = detail.currentX;
    const currentY = detail.currentY;
    const timestamp = detail.timeStamp;
    detail.deltaX = currentX - detail.startX;
    detail.deltaY = currentY - detail.startY;
    detail.event = ev;

    const timeRange = timestamp - 100;
    const positions = this.positions;
    let startPos = positions.length - 1;

    // move pointer to position measured 100ms ago
    while (startPos > 0 && positions[startPos] > timeRange) {
      startPos -= 3;
    }

    if (startPos > 1) {
      // compute relative movement between these two points
      const frequency = 1 / (positions[startPos] - timestamp);
      const movedY = positions[startPos - 1] - currentY;
      const movedX = positions[startPos - 2] - currentX;

      // based on XXms compute the movement to apply for each render step
      // velocity = space/time = s*(1/t) = s*frequency
      detail.velocityX = movedX * frequency;
      detail.velocityY = movedY * frequency;
    } else {
      detail.velocityX = 0;
      detail.velocityY = 0;
    }
    positions.push(currentX, currentY, timestamp);
  }

  private tryToCapturePan(): boolean {
    if (this.gesture && !this.gesture.capture()) {
      return false;
    }
    this.hasCapturedPan = true;
    this.hasFiredStart = false;

    // reset start position since the real user-land event starts here
    // If the pan detector threshold is big, not reseting the start position
    // will cause a jump in the animation equal to the detector threshold.
    // the array of positions used to calculate the gesture velocity does not
    // need to be cleaned, more points in the positions array always results in a
    // more acurate value of the velocity.
    const detail = this.detail;
    detail.startX = detail.currentX;
    detail.startY = detail.currentY;
    detail.startTimeStamp = detail.timeStamp;

    if (this.onWillStart) {
      this.onWillStart(detail).then(this.fireOnStart.bind(this));
    } else {
      this.fireOnStart();
    }
    return true;
  }

  private fireOnStart() {
    if (this.onStart) {
      this.onStart(this.detail);
    }
    this.hasFiredStart = true;
  }

  private abortGesture() {
    this.stop();
    this.notCaptured && this.notCaptured(this.detail);
  }

  private reset() {
    this.hasCapturedPan = false;
    this.hasStartedPan = false;
    this.isMoveQueued = false;
    this.hasFiredStart = true;
    this.gesture && this.gesture.release();
  }

  // END *************************

  @Listen('touchcancel', { passive: true, enabled: false })
  @Listen('touchend', { passive: true, enabled: false })
  onTouchCancel(ev: TouchEvent) {
    this.lastTouch = this.detail.timeStamp = now(ev);

    this.pointerUp(ev);
    this.enableTouch(false);
  }

  @Listen('document:mouseup', { passive: true, enabled: false })
  onMouseUp(ev: TouchEvent) {
    const timeStamp = now(ev);

    if (this.lastTouch + MOUSE_WAIT < timeStamp) {
      this.detail.timeStamp = timeStamp;
      this.pointerUp(ev);
      this.enableMouse(false);
    }
  }

  private pointerUp(ev: UIEvent) {
    const hasCaptured = this.hasCapturedPan;
    const hasFiredStart = this.hasFiredStart;
    this.reset();

    if (!hasFiredStart) {
      return;
    }
    const detail = this.detail;
    this.calcGestureData(ev);

    // Try to capture press
    if (hasCaptured) {
      if (this.onEnd) {
        this.onEnd(detail);
      }
      return;
    }

    // Not captured any event
    if (this.notCaptured) {
      this.notCaptured(detail);
    }
  }

  // ENABLE LISTENERS *************************

  private enableMouse(shouldEnable: boolean) {
    this.enableListener(this, 'document:mousemove', shouldEnable, undefined, this.passive);
    this.enableListener(this, 'document:mouseup', shouldEnable, undefined, this.passive);
  }

  private enableTouch(shouldEnable: boolean) {
    this.enableListener(this, 'touchmove', shouldEnable, this.attachTo, this.passive);
    this.enableListener(this, 'touchcancel', shouldEnable, this.attachTo, this.passive);
    this.enableListener(this, 'touchend', shouldEnable, this.attachTo, this.passive);
  }

  private enable(shouldEnable: boolean) {
    this.enableMouse(shouldEnable);
    this.enableTouch(shouldEnable);
  }
}

const MOUSE_WAIT = 2500;

export interface GestureDetail {
  event?: UIEvent;
  startX?: number;
  startY?: number;
  startTimeStamp?: number;
  currentX?: number;
  currentY?: number;
  velocityX?: number;
  velocityY?: number;
  deltaX?: number;
  deltaY?: number;
  timeStamp?: number;
  data?: any;
}


export interface GestureCallback {
  (detail?: GestureDetail): boolean|void;
}
