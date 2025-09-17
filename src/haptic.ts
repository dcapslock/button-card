import { fireEvent } from './common/fire-event';

// Allowed types are from iOS HIG.
// https://developer.apple.com/design/human-interface-guidelines/ios/user-interaction/feedback/#haptics
// Implementors on platforms other than iOS should attempt to match the patterns (shown in HIG) as closely as possible.
export type HapticType = 'success' | 'warning' | 'failure' | 'light' | 'medium' | 'heavy' | 'selection';

declare global {
  // for fire event
  interface HASSDomEvents {
    haptic: HapticType;
  }
}

export const forwardHaptic = (node: HTMLElement | Window, hapticType: HapticType) => {
  fireEvent(node, 'haptic', hapticType);
};

interface EMMessage {
  id?: number;
  type: string;
}

interface EMOutgoingMessageHaptic extends EMMessage {
  type: 'haptic';
  payload: { hapticType: string };
}

export type HapticFunctionVibrate = typeof window.navigator.vibrate | undefined;
export type HapticFunctionExternal = ((msg: any) => void) | undefined;
export interface HapticFunctions {
  vibrateFunction?: HapticFunctionVibrate;
  extrnalFunction?: HapticFunctionExternal;
}

const hapticInterceptVibrate = (): HapticFunctionVibrate => {
  if (!window.navigator.vibrate) return;
  const original = window.navigator.vibrate;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  window.navigator.vibrate = function (pattern: VibratePattern | Iterable<number>): boolean {
    console.debug('[button-card] Haptic Intercepted (vibrate):', pattern);
    return false;
  };
  return original;
};

const resetHapticInterceptVibrate = (original: typeof window.navigator.vibrate) => {
  if (!window.navigator.vibrate) return;
  window.navigator.vibrate = original;
};

const hapticInterceptExternal = (): HapticFunctionExternal => {
  if (!(window as any).externalApp || !(window as any).webkit!.messageHandlers) return;
  let original: HapticFunctionExternal;
  if ((window as any).externalApp) {
    original = (window as any).externalApp.externalBus;
    (window as any).externalApp.externalBus = function (msg: EMOutgoingMessageHaptic): void {
      if (msg && msg.type == 'haptic') {
        console.debug('[button-card] Haptic Intercepted (externalApp):', msg);
        return;
      }
      original?.(msg);
    };
    return;
  } else if ((window as any).webkit!.messageHandlers!.externalBus) {
    original = (window as any).webkit!.messageHandlers!.externalBus.postMessage;
    (window as any).webkit!.messageHandlers.externalBus.postMessage = function (msg: EMOutgoingMessageHaptic): void {
      if (msg && msg.type == 'haptic') {
        console.debug('[button-card] Haptic Intercepted (webkit):', msg);
        return;
      }
      original?.(msg);
    };
  }
  return original;
};

const resetHapticInterceptExternal = (original: HapticFunctionExternal) => {
  if (!(window as any).externalApp || !(window as any).webkit!.messageHandlers) return;
  if ((window as any).externalApp) {
    (window as any).externalApp.externalBus = original;
  } else if ((window as any).webkit!.messageHandlers!.externalBus) {
    (window as any).webkit!.messageHandlers!.externalBus.postMessage = original;
  }
};

export const hapticIntercept = (): HapticFunctions => {
  return {
    vibrateFunction: hapticInterceptVibrate(),
    extrnalFunction: hapticInterceptExternal(),
  };
};

export const handleHaptic = (hapticFunctions: HapticFunctions, haptic: string): void => {
  resetHapticInterceptVibrate(hapticFunctions.vibrateFunction as typeof window.navigator.vibrate);
  resetHapticInterceptExternal(hapticFunctions.extrnalFunction as HapticFunctionExternal);
  if (haptic && haptic !== 'none') {
    forwardHaptic(window, haptic as HapticType);
  }
};
