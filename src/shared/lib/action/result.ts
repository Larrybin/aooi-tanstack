
export type ActionResult = {
  status: 'success' | 'error';
  message: string;
  redirect_url?: string;
  requestId?: string;
};

export function actionOk(
  message: string,
  redirect_url?: string,
  requestId?: string
): ActionResult {
  return { status: 'success', message, redirect_url, requestId };
}

export function actionErr(message: string, requestId?: string): ActionResult {
  return { status: 'error', message, requestId };
}
