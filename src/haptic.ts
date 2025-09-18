import { fireEvent } from './common/fire-event';
import { EMMessage, EMOutgoingMessageHaptic, isExternal } from './types/homeassistant';

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

type HapticFunctionVibrate = typeof window.navigator.vibrate | undefined;
type HapticFunctionExternalApp = (payload: string) => any;
type HapticFunctionExternalWebkit = (payload: EMMessage) => any;

export interface HapticFunctions {
  vibrateFunction?: HapticFunctionVibrate;
  extrnalFunction?: HapticFunctionExternalApp | HapticFunctionExternalWebkit;
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

const hapticInterceptExternal = (): HapticFunctionExternalApp | HapticFunctionExternalWebkit | undefined => {
  if (!isExternal) return;
  if (window.externalApp) {
    const original = window.externalApp.externalBus.bind(window.externalApp);
    const patched = function (payload: string): any {
      let msg;
      try {
        msg = JSON.parse(payload);
      } catch (e) {
        msg = null;
      }
      if (msg && msg.type == 'haptic') {
        console.debug('[button-card] Haptic Intercepted (externalApp):', msg);
        return;
      }
      original(msg);
    };
    window.externalApp = { ...window.externalApp, externalBus: patched.bind(window.externalApp) };
    return original;
  } else if (window.webkit!.messageHandlers?.externalBus) {
    const original = window.webkit!.messageHandlers?.externalBus.postMessage.bind(
      window.webkit!.messageHandlers!.externalBus,
    );
    const patched = function (msg: EMOutgoingMessageHaptic): any {
      if (msg && msg.type == 'haptic') {
        console.debug('[button-card] Haptic Intercepted (webkit):', msg);
        return;
      }
      original(msg);
    };
    window.webkit!.messageHandlers!.externalBus.postMessage = patched.bind(window.webkit!.messageHandlers!.externalBus);
    return original;
  }
  return undefined;
};

const resetHapticInterceptExternal = (
  original: HapticFunctionExternalApp | HapticFunctionExternalWebkit | undefined,
) => {
  if (!isExternal) return;
  if (window.externalApp) {
    window.externalApp.externalBus = original as HapticFunctionExternalApp;
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
  resetHapticInterceptExternal(hapticFunctions.extrnalFunction);
  if (haptic && haptic.toLocaleLowerCase() !== 'none') {
    forwardHaptic(window, haptic as HapticType);
  }
};
