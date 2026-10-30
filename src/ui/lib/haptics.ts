/** Vibración del celular (si el navegador la soporta). En iPhone Safari no existe navigator.vibrate. */
export const haptic = {
  light: () => navigator.vibrate?.(15),
  medium: () => navigator.vibrate?.(30),
  heavy: () => navigator.vibrate?.(60),
  success: () => navigator.vibrate?.([100, 50, 150]),
  alarm: () => navigator.vibrate?.([300, 150, 300, 150, 300]),
};
